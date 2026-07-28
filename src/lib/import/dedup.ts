import { createHash } from "node:crypto";
import type { ParsedTransaction } from "./types";

/** Normalises a label for stable dedup: uppercase, no accents, single spaces. */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

type DedupInput = Pick<
  ParsedTransaction,
  "operation_date" | "amount" | "raw_label" | "external_id"
>;

/** Clé « contenu » d'une transaction (avant discriminant d'occurrence). */
export function baseKey(tx: DedupInput): string {
  return tx.external_id
    ? `id:${tx.external_id}`
    : `${tx.operation_date}|${tx.amount.toFixed(2)}|${normalizeLabel(tx.raw_label)}`;
}

/**
 * Deterministic dedup hash for a transaction within an account.
 * Prefers the bank's stable external id; falls back to the
 * date|amount|normalized-label composite from the spec.
 *
 * `occurrence` distingue des transactions au contenu identique dans un même
 * compte (ex. deux tickets de métro à 2,55 € le même jour) : la Nᵉ occurrence
 * reçoit un hash distinct, ce qui permet de les importer toutes tout en gardant
 * les ré-imports idempotents (même position → même hash → ignoré). L'occurrence
 * 0 conserve le hash historique (rétro-compatible).
 */
export function computeDedupHash(
  accountId: string,
  tx: DedupInput,
  occurrence = 0,
): string {
  const suffix = occurrence > 0 ? `|occ:${occurrence}` : "";
  return createHash("sha256")
    .update(`${accountId}|${baseKey(tx)}${suffix}`)
    .digest("hex");
}

/**
 * Attribue à chaque élément son indice d'occurrence (0, 1, 2…) au sein de son
 * groupe de clé identique, en respectant l'ordre d'entrée.
 */
export function assignOccurrences<T>(
  items: T[],
  keyOf: (item: T) => string,
): number[] {
  const counts = new Map<string, number>();
  return items.map((item) => {
    const k = keyOf(item);
    const n = counts.get(k) ?? 0;
    counts.set(k, n + 1);
    return n;
  });
}

/**
 * Résout le `dedup_hash` de chaque ligne d'un lot pour un compte.
 *
 * Les lignes normales gardent leur hash naturel (occurrence indexée dans le
 * lot) : ré-importer le même fichier reste idempotent. Une ligne marquée
 * `force` a été déflaguée manuellement (faux positif de la dédup) : on décale
 * son occurrence jusqu'à un hash absent à la fois de la base et des autres
 * lignes du lot, pour qu'elle soit réellement insérée malgré la contrainte
 * d'unicité `(account_id, dedup_hash)`.
 */
export function resolveDedupHashes<T extends DedupInput & { force?: boolean }>(
  accountId: string,
  items: T[],
  existingHashes: Set<string>,
): string[] {
  const occurrences = assignOccurrences(items, (t) => baseKey(t));
  const natural = items.map((t, i) =>
    computeDedupHash(accountId, t, occurrences[i]),
  );
  if (!items.some((t) => t.force)) return natural;

  // Hashs déjà pris : la base + les hashs naturels des lignes non forcées.
  const taken = new Set<string>(existingHashes);
  items.forEach((t, i) => {
    if (!t.force) taken.add(natural[i]);
  });

  return items.map((t, i) => {
    if (!t.force) return natural[i];
    let occ = occurrences[i];
    let hash = natural[i];
    while (taken.has(hash)) {
      occ += 1;
      hash = computeDedupHash(accountId, t, occ);
    }
    taken.add(hash);
    return hash;
  });
}

/** Removes in-batch duplicates by dedup hash, keeping the first occurrence. */
export function dedupeBatch<T extends { dedup_hash: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.dedup_hash)) continue;
    seen.add(row.dedup_hash);
    out.push(row);
  }
  return out;
}
