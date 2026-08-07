import { createClient } from "@/lib/supabase/server";
import { applyRules } from "@/lib/rules/engine";
import { loadEngineRules } from "@/lib/rules/loader";
import { matchesPattern } from "@/lib/recurring/checker";
import { merchantCompatible, recurringAcceptableMerchants } from "./merchantGate";
import { dedupeBatch, resolveDedupHashes } from "./dedup";
import type { ParsedTransaction, ImportSummary } from "./types";
import type { Database } from "@/types/database.types";

type TransactionInsert =
  Database["public"]["Tables"]["transactions"]["Insert"];

interface ImportOptions {
  bankFormat: string;
  sourceFilename: string;
  sourceStoragePath?: string | null;
}

/** Répartit `total` en `n` parts égales (le reste au centime va à la 1re part). */
function equalShares(total: number, n: number): number[] {
  if (n <= 0) return [];
  const each = Math.floor((total / n) * 100) / 100;
  const parts = new Array(n).fill(each);
  parts[0] = Math.round((total - each * (n - 1)) * 100) / 100;
  return parts;
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
    const [{ rules, hitBase }, { data: patternRows }] = await Promise.all([
      loadEngineRules(supabase),
      supabase.from("recurring_patterns").select("*").eq("is_active", true),
    ]);

    const patterns = patternRows ?? [];

    const nowIso = new Date().toISOString();

    // Lignes déflaguées (`force`) : détectées à tort comme doublon déjà en base.
    // On charge les hashs existants du compte pour leur attribuer une occurrence
    // libre (les lignes normales restent idempotentes). Requête évitée sans
    // ligne forcée.
    let existingHashes = new Set<string>();
    if (parsed.some((p) => p.force)) {
      const { data: existing } = await supabase
        .from("transactions")
        .select("dedup_hash")
        .eq("account_id", accountId);
      existingHashes = new Set((existing ?? []).map((r) => r.dedup_hash));
    }
    const dedupHashes = resolveDedupHashes(accountId, parsed, existingHashes);

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

        // Enseigne : l'aperçu fait foi quand il fournit `merchant_id` (règle,
        // achat ou choix manuel) ; sinon rattachement automatique par la règle.
        const explicitMerchant =
          "merchant_id" in p ? (p.merchant_id ?? null) : undefined;
        // Enseigne faisant autorité (aperçu sinon règle) : elle gate la
        // récurrence et n'est jamais écrasée par celle-ci.
        const authorityMerchant =
          explicitMerchant !== undefined
            ? explicitMerchant
            : overridden
              ? null
              : outcome.merchant_id;

        // Récurrentes : une transaction qui correspond à un modèle récurrent
        // (libellé + montant) est marquée récurrente — à condition que
        // l'enseigne du modèle ne contredise pas celle de la transaction.
        const pattern = patterns.find(
          (pat) =>
            matchesPattern(pat, {
              account_id: accountId,
              raw_label: p.raw_label,
              amount: p.amount,
              operation_date: p.operation_date,
            }) &&
            merchantCompatible(authorityMerchant, recurringAcceptableMerchants(pat.merchant_id)),
        );
        if (pattern) {
          // Catégorie héritée du modèle si la ligne n'en a pas encore.
          if (subcategoryId == null && pattern.subcategory_id) {
            subcategoryId = pattern.subcategory_id;
          }
          // Occurrence d'une récurrente connue et catégorisée (par une règle,
          // l'aperçu ou le modèle) = transaction de confiance : on la valide
          // automatiquement, plus besoin de la revoir dans « à valider ».
          if (subcategoryId != null) {
            status = "validated";
          }
        }
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
          // Note libre saisie dans l'aperçu (annotation directe).
          note: p.note?.trim() ? p.note.trim() : null,
          is_recurring: Boolean(pattern),
          recurring_pattern_id: pattern?.id ?? null,
          // Ventilation entre personnes choisie dans l'aperçu (nature globale).
          split_nature:
            p.persons && p.persons.personIds.length > 0 ? p.persons.nature : null,
          validated_at: status === "validated" ? nowIso : null,
          dedup_hash: dedupHashes[i],
        };
      },
    );

    // Plans de ventilation indexés par dedup_hash (résout l'id après insert).
    const personPlans = parsed
      .map((p, i) => ({
        hash: rows[i].dedup_hash,
        amount: p.amount,
        persons: p.persons,
      }))
      .filter((x) => x.persons && x.persons.personIds.length > 0);

    const batch = dedupeBatch(rows);

    const { data: inserted, error: insertErr } = await supabase
      .from("transactions")
      .upsert(batch, {
        onConflict: "account_id,dedup_hash",
        ignoreDuplicates: true,
      })
      .select("id, status, applied_rule_id, dedup_hash");

    if (insertErr) throw new Error(insertErr.message);

    const insertedRows = inserted ?? [];
    const rowsImported = insertedRows.length;
    const rowsAutoValidated = insertedRows.filter(
      (r) => r.status === "validated",
    ).length;
    // Id des transactions réellement insérées, par dedup_hash (les doublons
    // ignorés n'en ont pas). Sert à la ventilation et aux échéances d'achats.
    const idByHash = new Map(
      insertedRows.map((r) => [r.dedup_hash, r.id] as const),
    );

    // Échéances d'achats choisies dans l'aperçu (« transaction non matchée » ou
    // création d'une nouvelle échéance) : appariées après l'insertion, en
    // adoptant le montant réel. Fait avant le matchPurchaseInstallments global.
    const newInstallments: {
      purchase_id: string;
      month: string;
      amount: number;
      transaction_id: string;
    }[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      if (!p.purchase_id) continue;
      const txId = idByHash.get(rows[i].dedup_hash);
      if (!txId) continue; // doublon non importé
      if (p.installment_id) {
        await supabase
          .from("purchase_installments")
          .update({ transaction_id: txId, amount: p.amount })
          .eq("id", p.installment_id)
          .is("transaction_id", null);
      } else if (p.installment_create) {
        newInstallments.push({
          purchase_id: p.purchase_id,
          month: `${p.operation_date.slice(0, 7)}-01`,
          amount: p.amount,
          transaction_id: txId,
        });
      }
    }
    if (newInstallments.length > 0) {
      await supabase.from("purchase_installments").insert(newInstallments);
    }

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

    // Ventilation entre personnes : parts égales insérées pour les lignes
    // réellement importées (les doublons ignorés n'ont pas d'id).
    if (personPlans.length > 0) {
      const shareRows: {
        transaction_id: string;
        person_id: string;
        share_amount: number;
      }[] = [];
      for (const plan of personPlans) {
        const txId = idByHash.get(plan.hash);
        if (!txId || !plan.persons) continue;
        const ids = plan.persons.personIds;
        const parts = equalShares(Math.abs(plan.amount), ids.length);
        ids.forEach((personId, k) => {
          shareRows.push({
            transaction_id: txId,
            person_id: personId,
            share_amount: parts[k],
          });
        });
      }
      if (shareRows.length > 0) {
        await supabase.from("transaction_persons").insert(shareRows);
      }
    }

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
