import { createClient } from "@/lib/supabase/server";
import { applyRules, type EngineRule } from "@/lib/rules/engine";
import { computeDedupHash, dedupeBatch } from "./dedup";
import type { ParsedTransaction, ImportSummary } from "./types";
import type { Database } from "@/types/database.types";

type TransactionInsert =
  Database["public"]["Tables"]["transactions"]["Insert"];

interface ImportOptions {
  bankFormat: string;
  sourceFilename: string;
  sourceStoragePath?: string | null;
}

function toEngineRule(
  r: Database["public"]["Tables"]["categorization_rules"]["Row"],
): EngineRule {
  return {
    id: r.id,
    match_type: r.match_type,
    pattern: r.pattern,
    case_sensitive: r.case_sensitive,
    account_id: r.account_id,
    amount_min: r.amount_min == null ? null : Number(r.amount_min),
    amount_max: r.amount_max == null ? null : Number(r.amount_max),
    subcategory_id: r.subcategory_id,
    auto_validate: r.auto_validate,
    priority: r.priority,
    is_active: r.is_active,
  };
}

/**
 * Shared import pipeline: dedup, rule categorisation, bulk insert and
 * import bookkeeping. Used by every transaction source (bank API, CSV…).
 */
export async function importParsedTransactions(
  accountId: string,
  parsed: ParsedTransaction[],
  options: ImportOptions,
): Promise<ImportSummary> {
  const supabase = await createClient();

  const { data: importRow, error: importErr } = await supabase
    .from("imports")
    .insert({
      account_id: accountId,
      source_filename: options.sourceFilename,
      source_storage_path: options.sourceStoragePath ?? null,
      bank_format: options.bankFormat,
      status: "processing",
      rows_total: parsed.length,
    })
    .select("id")
    .single();

  if (importErr || !importRow) {
    throw new Error(importErr?.message ?? "Création de l'import impossible");
  }
  const importId = importRow.id;

  try {
    const { data: ruleRows } = await supabase
      .from("categorization_rules")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: true });

    const rules = (ruleRows ?? []).map(toEngineRule);
    const hitBase = new Map(
      (ruleRows ?? []).map((r) => [r.id, r.hit_count]),
    );

    const nowIso = new Date().toISOString();

    const rows: (TransactionInsert & { dedup_hash: string })[] = parsed.map(
      (p) => {
        const outcome = applyRules(
          { account_id: accountId, amount: p.amount, raw_label: p.raw_label },
          rules,
        );
        return {
          account_id: accountId,
          import_id: importId,
          operation_date: p.operation_date,
          value_date: p.value_date ?? null,
          label: p.label.slice(0, 500),
          raw_label: p.raw_label,
          amount: p.amount,
          currency: p.currency,
          status: outcome.status,
          subcategory_id: outcome.subcategory_id,
          applied_rule_id: outcome.applied_rule_id,
          validated_at: outcome.status === "validated" ? nowIso : null,
          dedup_hash: computeDedupHash(accountId, p),
        };
      },
    );

    const batch = dedupeBatch(rows);

    const { data: inserted, error: insertErr } = await supabase
      .from("transactions")
      .upsert(batch, {
        onConflict: "account_id,dedup_hash",
        ignoreDuplicates: true,
      })
      .select("id, status, applied_rule_id");

    if (insertErr) throw new Error(insertErr.message);

    const insertedRows = inserted ?? [];
    const rowsImported = insertedRows.length;
    const rowsAutoValidated = insertedRows.filter(
      (r) => r.status === "validated",
    ).length;

    // Increment rule hit counts for matched & inserted transactions.
    const hitDelta = new Map<string, number>();
    for (const r of insertedRows) {
      if (r.applied_rule_id) {
        hitDelta.set(r.applied_rule_id, (hitDelta.get(r.applied_rule_id) ?? 0) + 1);
      }
    }
    await Promise.all(
      [...hitDelta.entries()].map(([ruleId, delta]) =>
        supabase
          .from("categorization_rules")
          .update({
            hit_count: (hitBase.get(ruleId) ?? 0) + delta,
            last_hit_at: nowIso,
          })
          .eq("id", ruleId),
      ),
    );

    await supabase
      .from("imports")
      .update({
        status: "completed",
        rows_imported: rowsImported,
        rows_duplicates: parsed.length - rowsImported,
      })
      .eq("id", importId);

    return {
      import_id: importId,
      rows_total: parsed.length,
      rows_imported: rowsImported,
      rows_duplicates: parsed.length - rowsImported,
      rows_auto_validated: rowsAutoValidated,
    };
  } catch (err) {
    await supabase
      .from("imports")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Erreur inconnue",
      })
      .eq("id", importId);
    throw err;
  }
}
