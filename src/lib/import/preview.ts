import { computeDedupHash, normalizeLabel } from "./dedup";
import { connectionLabel, normalizeConnection } from "./connection";
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

// ── Import CSV multi-comptes : rapprochement par « Nom de la connexion ── ────

/** Regroupe les transactions par clé de connexion normalisée. */
export function groupByConnection(
  transactions: ParsedTransaction[],
): Map<string, { label: string; txs: ParsedTransaction[] }> {
  const groups = new Map<string, { label: string; txs: ParsedTransaction[] }>();
  for (const t of transactions) {
    const label = connectionLabel(t.connection_name);
    const key = normalizeConnection(t.connection_name);
    const g = groups.get(key) ?? { label, txs: [] };
    g.txs.push(t);
    groups.set(key, g);
  }
  return groups;
}

export interface CsvTarget {
  /** Libellé de connexion affiché. */
  label: string;
  /** Clé normalisée de connexion. */
  key: string;
  /** Compte existant rattaché, ou null si à créer. */
  accountId: string | null;
  /** Hash de dédup (uniquement si un compte existe déjà). */
  hash: string | null;
}

export interface CsvPreviewRow extends PreviewRow {
  connectionLabel: string;
  /** true si la connexion correspond à un compte déjà existant. */
  targetAccountExists: boolean;
}

export interface ConnectionSummary {
  label: string;
  count: number;
  /** true = compte existant, false = sera créé à l'import. */
  exists: boolean;
}

/** Résout, pour chaque transaction, le compte cible (existant) et son hash. */
export function resolveCsvTargets(
  transactions: ParsedTransaction[],
  accountIdByConnection: Map<string, string>,
): CsvTarget[] {
  return transactions.map((t) => {
    const label = connectionLabel(t.connection_name);
    const key = normalizeConnection(t.connection_name);
    const accountId = accountIdByConnection.get(key) ?? null;
    return {
      label,
      key,
      accountId,
      hash: accountId ? computeDedupHash(accountId, t) : null,
    };
  });
}

/**
 * Construit l'aperçu d'un import CSV : lignes avec statut de doublon
 * (existant en base pour les comptes connus, répété dans le fichier sinon)
 * et récapitulatif par connexion (existant vs à créer).
 */
export function buildCsvPreview(
  transactions: ParsedTransaction[],
  targets: CsvTarget[],
  existingHashes: Set<string>,
): { rows: CsvPreviewRow[]; connections: ConnectionSummary[] } {
  const seen = new Set<string>();
  const rows = transactions.map((t, i) => {
    const tg = targets[i];
    const existing = tg.hash ? existingHashes.has(tg.hash) : false;
    const inFileKey = `${tg.key}|${t.operation_date}|${t.amount.toFixed(2)}|${normalizeLabel(t.raw_label)}`;
    const inFile = !existing && seen.has(inFileKey);
    seen.add(inFileKey);
    const reason: DuplicateReason = existing
      ? "existing"
      : inFile
        ? "in_file"
        : null;
    return {
      ...t,
      duplicate: reason !== null,
      duplicateReason: reason,
      connectionLabel: tg.label,
      targetAccountExists: tg.accountId !== null,
    };
  });

  const byConnection = new Map<string, ConnectionSummary>();
  for (const tg of targets) {
    const existing = byConnection.get(tg.key);
    if (existing) existing.count += 1;
    else
      byConnection.set(tg.key, {
        label: tg.label,
        count: 1,
        exists: tg.accountId !== null,
      });
  }

  return { rows, connections: [...byConnection.values()] };
}
