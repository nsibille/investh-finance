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

/**
 * Deterministic dedup hash for a transaction within an account.
 * Prefers the bank's stable external id; falls back to the
 * date|amount|normalized-label composite from the spec.
 */
export function computeDedupHash(
  accountId: string,
  tx: Pick<
    ParsedTransaction,
    "operation_date" | "amount" | "raw_label" | "external_id"
  >,
): string {
  const base = tx.external_id
    ? `id:${tx.external_id}`
    : `${tx.operation_date}|${tx.amount.toFixed(2)}|${normalizeLabel(tx.raw_label)}`;
  return createHash("sha256").update(`${accountId}|${base}`).digest("hex");
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
