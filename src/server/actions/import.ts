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
