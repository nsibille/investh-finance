"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importParsedTransactions } from "@/lib/import/importer";
import {
  importCsvTransactions,
  type CsvImportSummary,
} from "@/lib/import/csvImporter";
import { detectAndTagInternalTransfers } from "@/lib/import/transfers";
import { detectAndTagDeferredDebits } from "@/lib/import/deferred";
import {
  matchPurchaseInstallments,
  matchPreviewRowsToPurchases,
  type PreviewRow,
  type PreviewPurchaseMatch,
} from "@/lib/purchases/match";
import { ensureRecurringInstallments } from "@/lib/purchases/recurring";
import type { ParsedTransaction, ImportSummary } from "@/lib/import/types";

type Result =
  | ({ ok: true; transfersDetected: number } & { summary: ImportSummary })
  | { ok: false; error: string };

type CsvResult =
  | ({ ok: true; transfersDetected: number } & { summary: CsvImportSummary })
  | { ok: false; error: string };

/**
 * Confirme un import (PDF ou CSV). `sourceFormat` identifie l'origine
 * (ex. `pdf:bforbank`, `csv:bankin`) et est journalisé dans la table imports.
 */
export async function confirmImport(
  accountId: string,
  transactions: ParsedTransaction[],
  sourceFormat: string,
  filename: string,
): Promise<Result> {
  if (!accountId) return { ok: false, error: "Compte manquant" };
  if (transactions.length === 0) return { ok: false, error: "Aucune transaction à importer" };

  try {
    const summary = await importParsedTransactions(accountId, transactions, {
      bankFormat: sourceFormat,
      sourceFilename: filename,
    });
    const transfersDetected = await detectAndTagInternalTransfers();
    // Débits différés : sortis de la compta (catégorie « Débit différé »).
    await detectAndTagDeferredDebits();
    // Étend les échéances récurrentes (nouveaux mois) avant l'appariement.
    await ensureRecurringInstallments();
    await matchPurchaseInstallments();
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/achats");
    return { ok: true, summary, transfersDetected };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'import" };
  }
}

/**
 * Confirme un import CSV multi-comptes : chaque transaction est rattachée au
 * compte de sa connexion (créé à la volée si besoin). Aucun compte à
 * sélectionner au préalable.
 */
export async function confirmCsvImport(
  transactions: ParsedTransaction[],
  filename: string,
): Promise<CsvResult> {
  if (transactions.length === 0) {
    return { ok: false, error: "Aucune transaction à importer" };
  }
  try {
    const summary = await importCsvTransactions(transactions, filename);
    const transfersDetected = await detectAndTagInternalTransfers();
    // Débits différés : sortis de la compta (catégorie « Débit différé »).
    await detectAndTagDeferredDebits();
    // Étend les échéances récurrentes (nouveaux mois) avant l'appariement.
    await ensureRecurringInstallments();
    await matchPurchaseInstallments();
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/achats");
    return { ok: true, summary, transfersDetected };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'import" };
  }
}

type RealignResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Recale la date d'opérations déjà en base sur les comptes carte à débit
 * différé : une opération dont la date provisoire (fin de mois) s'est recalée à
 * sa date réelle est détectée en doublon à l'import ; plutôt que de l'ignorer
 * silencieusement, on met à jour la date de l'opération existante.
 *
 * Garde-fous serveur : on ne déplace que dans le MÊME mois et uniquement vers
 * une date ANTÉRIEURE (on ne régresse jamais une date réelle vers le provisoire).
 */
export async function realignDeferredDates(
  items: { id: string; toDate: string }[],
): Promise<RealignResult> {
  const clean = items.filter(
    (i) => i.id && /^\d{4}-\d{2}-\d{2}$/.test(i.toDate),
  );
  if (clean.length === 0) return { ok: true, count: 0 };

  try {
    const supabase = await createClient();
    const ids = [...new Set(clean.map((i) => i.id))];
    const { data: current } = await supabase
      .from("transactions")
      .select("id, operation_date")
      .in("id", ids);
    const curById = new Map((current ?? []).map((r) => [r.id, r.operation_date]));

    let count = 0;
    for (const it of clean) {
      const cur = curById.get(it.id);
      if (!cur) continue;
      // Même mois uniquement, et recalage vers une date strictement antérieure.
      if (cur.slice(0, 7) !== it.toDate.slice(0, 7)) continue;
      if (it.toDate >= cur) continue;
      const { error } = await supabase
        .from("transactions")
        .update({ operation_date: it.toDate })
        .eq("id", it.id);
      if (!error) count += 1;
    }

    if (count > 0) {
      revalidatePath("/transactions");
      revalidatePath("/accounts");
      revalidatePath("/dashboard");
    }
    return { ok: true, count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de recalage" };
  }
}

type RematchResult =
  | { ok: true; matches: { index: number; match: PreviewPurchaseMatch }[] }
  | { ok: false; error: string };

/**
 * Rejoue l'appariement des lignes de l'aperçu aux mensualités d'achats, à la
 * demande. Le pré-rattachement de l'aperçu est calculé une seule fois au parse
 * du fichier ; ce recalcul permet de reconnaître les achats créés *après* (au
 * retour sur /import ou via le bouton « Ré-analyser ») sans re-uploader.
 * `rows` porte l'index d'origine dans l'aperçu ; les doublons existants sont
 * exclus en amont (comme au parse).
 */
export async function rematchPreviewPurchases(
  rows: PreviewRow[],
): Promise<RematchResult> {
  try {
    const supabase = await createClient();
    const map = await matchPreviewRowsToPurchases(supabase, rows);
    return {
      ok: true,
      matches: [...map.entries()].map(([index, match]) => ({ index, match })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur d'analyse",
    };
  }
}
