"use server";

import { revalidatePath } from "next/cache";
import { importParsedTransactions } from "@/lib/import/importer";
import {
  importCsvTransactions,
  type CsvImportSummary,
} from "@/lib/import/csvImporter";
import { detectAndTagInternalTransfers } from "@/lib/import/transfers";
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
    revalidatePath("/transactions");
    revalidatePath("/accounts");
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
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { ok: true, summary, transfersDetected };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'import" };
  }
}
