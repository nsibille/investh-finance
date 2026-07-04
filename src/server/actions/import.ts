"use server";

import { revalidatePath } from "next/cache";
import { importParsedTransactions } from "@/lib/import/importer";
import type { ParsedTransaction, ImportSummary } from "@/lib/import/types";

type Result = ({ ok: true } & { summary: ImportSummary }) | { ok: false; error: string };

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
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur d'import" };
  }
}
