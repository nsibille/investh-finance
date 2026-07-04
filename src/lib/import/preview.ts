import { computeDedupHash } from "./dedup";
import type { ParsedTransaction } from "./types";

/** Pourquoi une ligne est marquée comme doublon. */
export type DuplicateReason = "existing" | "in_file" | null;

export interface PreviewRow extends ParsedTransaction {
  duplicate: boolean;
  duplicateReason: DuplicateReason;
}

/**
 * Marque chaque transaction comme doublon selon la clé date | libellé | montant :
 * - `existing` : déjà présente en base pour ce compte ;
 * - `in_file`  : répétée plus haut dans le fichier importé.
 * Décochée par défaut côté UI, l'utilisateur garde le dernier mot.
 */
export function buildPreviewRows(
  accountId: string,
  transactions: ParsedTransaction[],
  existingHashes: Set<string>,
): { rows: PreviewRow[]; hashes: string[] } {
  const hashes = transactions.map((t) => computeDedupHash(accountId, t));
  const seen = new Set<string>();

  const rows = transactions.map((t, i) => {
    const h = hashes[i];
    const existing = existingHashes.has(h);
    const inFile = !existing && seen.has(h);
    seen.add(h);
    const reason: DuplicateReason = existing
      ? "existing"
      : inFile
        ? "in_file"
        : null;
    return { ...t, duplicate: reason !== null, duplicateReason: reason };
  });

  return { rows, hashes };
}
