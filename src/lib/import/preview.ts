import {
  computeDedupHash,
  assignOccurrences,
  baseKey,
  contentKey,
  matchContentDuplicates,
  type DuplicateMatch,
  type ExistingEntry,
} from "./dedup";
import { connectionLabel, normalizeConnection } from "./connection";
import type { ParsedTransaction } from "./types";

/** Pourquoi une ligne est marquée comme doublon (seulement si déjà en base). */
export type DuplicateReason = "existing" | null;

export interface PreviewRow extends ParsedTransaction {
  duplicate: boolean;
  duplicateReason: DuplicateReason;
  /** Détail de la similitude quand la ligne est un doublon (pour l'aperçu). */
  duplicateMatch: DuplicateMatch | null;
}

/** Hash de dédup (indexé par occurrence) pour chaque transaction d'un compte. */
export function occurrenceHashes(
  accountId: string,
  transactions: ParsedTransaction[],
): string[] {
  const occ = assignOccurrences(transactions, (t) => baseKey(t));
  return transactions.map((t, i) => computeDedupHash(accountId, t, occ[i]));
}

/**
 * Marque une transaction comme doublon UNIQUEMENT si elle est déjà présente en
 * base pour ce compte (protection contre le ré-import). La détection combine :
 *   1. le hash exact (idempotence d'un ré-import de même source) ;
 *   2. la signature « inter-source » compte + date + montant (`existingContent`),
 *      qui rattrape une opération déjà importée par un autre canal, dont le
 *      libellé — donc le hash — diffère.
 * Les répétitions au sein du même fichier sont des opérations distinctes
 * (occurrence indexée) et ne consomment que les emplacements réellement en base.
 * Un `existing` est décoché par défaut et non ré-importable.
 */
export function buildPreviewRows(
  accountId: string,
  transactions: ParsedTransaction[],
  existingHashes: Set<string>,
  existingContent: Map<string, ExistingEntry[]> = new Map(),
  monthly = false,
): { rows: PreviewRow[]; hashes: string[] } {
  const occ = assignOccurrences(transactions, (t) => baseKey(t));
  const hashes = transactions.map((t, i) => computeDedupHash(accountId, t, occ[i]));

  const candidates = transactions.map((t, i) => ({
    key: contentKey(accountId, t.operation_date, t.amount, monthly),
    label: t.raw_label,
    hashDuplicate: existingHashes.has(hashes[i]),
    monthly,
  }));
  const matches = matchContentDuplicates(candidates, existingContent);

  const rows = transactions.map((t, i) => {
    const match = matches[i];
    const reason: DuplicateReason = match ? "existing" : null;
    return {
      ...t,
      duplicate: reason !== null,
      duplicateReason: reason,
      duplicateMatch: match,
    };
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
  /** Indice d'occurrence dans le groupe (connexion + contenu identique). */
  occurrence: number;
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

/** Résout, pour chaque transaction, le compte cible (existant), l'occurrence et le hash. */
export function resolveCsvTargets(
  transactions: ParsedTransaction[],
  accountIdByConnection: Map<string, string>,
): CsvTarget[] {
  // Occurrence par groupe (connexion + contenu identique) : deux opérations
  // identiques d'une même connexion reçoivent des indices distincts.
  const occ = assignOccurrences(
    transactions,
    (t) => `${normalizeConnection(t.connection_name)}|${baseKey(t)}`,
  );
  return transactions.map((t, i) => {
    const label = connectionLabel(t.connection_name);
    const key = normalizeConnection(t.connection_name);
    const accountId = accountIdByConnection.get(key) ?? null;
    return {
      label,
      key,
      accountId,
      occurrence: occ[i],
      hash: accountId ? computeDedupHash(accountId, t, occ[i]) : null,
    };
  });
}

/**
 * Construit l'aperçu d'un import CSV : lignes marquées « existant » uniquement
 * si déjà en base (compte connu), et récapitulatif par connexion (existant vs
 * à créer). Les répétitions dans le fichier restent « nouvelles ».
 */
export function buildCsvPreview(
  transactions: ParsedTransaction[],
  targets: CsvTarget[],
  existingHashes: Set<string>,
  existingContent: Map<string, ExistingEntry[]> = new Map(),
  deferredAccountIds: Set<string> = new Set(),
): { rows: CsvPreviewRow[]; connections: ConnectionSummary[] } {
  // Candidat « inter-source » par compte cible (les connexions à créer n'ont pas
  // de compte : clé neutre jamais présente dans `existingContent`). La
  // granularité passe au mois pour les comptes carte à débit différé.
  const candidates = transactions.map((t, i) => {
    const monthly = targets[i].accountId
      ? deferredAccountIds.has(targets[i].accountId as string)
      : false;
    return {
      key: targets[i].accountId
        ? contentKey(targets[i].accountId as string, t.operation_date, t.amount, monthly)
        : "",
      label: t.raw_label,
      hashDuplicate: Boolean(targets[i].hash && existingHashes.has(targets[i].hash as string)),
      monthly,
    };
  });
  const matches = matchContentDuplicates(candidates, existingContent);

  const rows = transactions.map((t, i) => {
    const tg = targets[i];
    const match = matches[i];
    const reason: DuplicateReason = match ? "existing" : null;
    return {
      ...t,
      duplicate: reason !== null,
      duplicateReason: reason,
      duplicateMatch: match,
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
