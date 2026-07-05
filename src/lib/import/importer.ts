import { createClient } from "@/lib/supabase/server";
import { applyRules, toEngineRule } from "@/lib/rules/engine";
import { matchesPattern } from "@/lib/recurring/checker";
import { computeDedupHash, dedupeBatch, assignOccurrences, baseKey } from "./dedup";
import type { ParsedTransaction, ImportSummary } from "./types";
import type { Database } from "@/types/database.types";

type TransactionInsert =
  Database["public"]["Tables"]["transactions"]["Insert"];

interface ImportOptions {
  bankFormat: string;
  sourceFilename: string;
  sourceStoragePath?: string | null;
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
    const [{ data: ruleRows }, { data: patternRows }] = await Promise.all([
      supabase
        .from("categorization_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true }),
      supabase.from("recurring_patterns").select("*").eq("is_active", true),
    ]);

    const rules = (ruleRows ?? []).map(toEngineRule);
    const patterns = patternRows ?? [];
    const hitBase = new Map(
      (ruleRows ?? []).map((r) => [r.id, r.hit_count]),
    );

    const nowIso = new Date().toISOString();
    const occurrences = assignOccurrences(parsed, (p) => baseKey(p));

    const rows: (TransactionInsert & { dedup_hash: string })[] = parsed.map(
      (p, i) => {
        const outcome = applyRules(
          { account_id: accountId, amount: p.amount, raw_label: p.raw_label },
          rules,
        );
        // Catégorie choisie dans l'aperçu : présence de `subcategory_id` dans
        // la charge utile = l'utilisateur a revu/modifié la catégorie proposée
        // par les règles. On la respecte ; sinon les règles font foi (et leur
        // compteur de hits est mis à jour).
        const overridden = "subcategory_id" in p;
        let subcategoryId = overridden
          ? (p.subcategory_id ?? null)
          : outcome.subcategory_id;
        let status = overridden
          ? subcategoryId
            ? "validated"
            : "pending"
          : outcome.status;
        const appliedRuleId = overridden ? null : outcome.applied_rule_id;

        // Récurrentes : une transaction qui correspond à un modèle récurrent
        // (libellé + montant) est marquée récurrente ; si elle n'a pas encore
        // de catégorie, on applique celle du modèle.
        const pattern = patterns.find((pat) =>
          matchesPattern(pat, {
            account_id: accountId,
            raw_label: p.raw_label,
            amount: p.amount,
            operation_date: p.operation_date,
          }),
        );
        if (pattern && subcategoryId == null && pattern.subcategory_id) {
          subcategoryId = pattern.subcategory_id;
          status = "validated";
        }
        // Enseigne : l'aperçu fait foi quand il fournit `merchant_id` (règle,
        // achat ou choix manuel) ; sinon rattachement automatique par la règle.
        const explicitMerchant =
          "merchant_id" in p ? (p.merchant_id ?? null) : undefined;
        const merchantId =
          explicitMerchant !== undefined
            ? explicitMerchant
            : (overridden ? null : outcome.merchant_id) ??
              pattern?.merchant_id ??
              null;
        return {
          account_id: accountId,
          import_id: importId,
          operation_date: p.operation_date,
          value_date: p.value_date ?? null,
          label: p.label.slice(0, 500),
          raw_label: p.raw_label,
          amount: p.amount,
          currency: p.currency,
          status,
          subcategory_id: subcategoryId,
          applied_rule_id: appliedRuleId,
          merchant_id: merchantId,
          purchase_id: p.purchase_id ?? null,
          is_recurring: Boolean(pattern),
          recurring_pattern_id: pattern?.id ?? null,
          validated_at: status === "validated" ? nowIso : null,
          dedup_hash: computeDedupHash(accountId, p, occurrences[i]),
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
