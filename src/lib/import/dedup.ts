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
 * Signature « inter-source » d'une opération : compte + date + montant, SANS le
 * libellé ni l'external_id. Deux imports d'une même opération par des canaux
 * différents (sync bancaire vs export CSV) produisent des libellés — donc des
 * `dedup_hash` — distincts ; cette clé, indépendante de la source, sert de
 * premier crible pour rapprocher les doublons à l'aperçu (le libellé départage
 * ensuite, cf. `labelsSimilar`).
 *
 * `monthly` élargit la granularité de la date au MOIS : sur un compte carte à
 * débit différé, une même opération peut s'afficher provisoirement en fin de
 * mois puis se recaler à sa date réelle (même mois). On compare alors
 * compte + mois + montant pour rattraper ce décalage (cf. `is_deferred_card`).
 */
export function contentKey(
  accountId: string,
  operationDate: string,
  amount: number,
  monthly = false,
): string {
  const datePart = monthly ? operationDate.slice(0, 7) : operationDate;
  return `${accountId}|${datePart}|${amount.toFixed(2)}`;
}

/**
 * Termes structurels des libellés bancaires FR (≥ 3 lettres), non discriminants :
 * ils décrivent la *nature* de l'opération, jamais la contrepartie. On les
 * retire avant de comparer deux libellés pour ne garder que ce qui identifie
 * réellement l'opération (nom du bénéficiaire, enseigne…).
 */
const LABEL_STOPWORDS = new Set([
  "VIR", "VIREMENT", "VIRT", "INST", "INSTANTANE", "INSTANTANEE", "RECU",
  "RECUE", "EMIS", "EMISE", "PAR", "POUR", "DES", "LES", "UNE", "AUX", "SUR",
  "AVEC", "SANS", "MOTIF", "REF", "REFERENCE", "DATE", "PRLV", "PRELEVEMENT",
  "PRELVT", "PRLVT", "CARTE", "PAIEMENT", "PAIMENT", "PAIE", "ACHAT", "RETRAIT",
  "DAB", "GAB", "MLLE", "MME", "MONSIEUR", "MADAME", "SARL", "SASU", "EURL",
  "FACT", "FACTURE", "ECH", "ECHEANCE", "MENSUALITE", "NUM", "NUMERO", "COM",
  "COMMANDE", "WEB", "ONLINE", "EUR", "EUROS",
]);

/**
 * Tokens discriminants d'un libellé : normalisé, découpé sur tout ce qui n'est
 * pas alphanumérique, en écartant les nombres (n° de référence, date, heure),
 * les tokens < 3 caractères et les termes bancaires structurels (`LABEL_STOPWORDS`).
 */
export function significantTokens(label: string): Set<string> {
  const tokens = normalizeLabel(label)
    .split(/[^A-Z0-9]+/)
    .filter(
      (t) => t.length >= 3 && !/^\d+$/.test(t) && !LABEL_STOPWORDS.has(t),
    );
  return new Set(tokens);
}

/**
 * Deux libellés désignent-ils la même opération ? Vrai s'ils partagent au moins
 * un token discriminant (ex. « KAMINSKI », « CELIA »), ce qui reste robuste
 * quand une source ajoute un n° de référence, une date/heure ou reformule les
 * termes structurels. Si l'un des deux n'a aucun token discriminant (libellé
 * purement structurel, ex. « VIREMENT RECU »), on ne peut pas départager : on
 * s'en remet alors à la seule signature compte+date+montant (biais « attrape le
 * doublon », décoché par défaut et réversible dans l'aperçu).
 */
export function labelsSimilar(a: string, b: string): boolean {
  const A = significantTokens(a);
  const B = significantTokens(b);
  if (A.size === 0 || B.size === 0) return true;
  for (const t of A) if (B.has(t)) return true;
  return false;
}

/**
 * Tokens discriminants communs à deux libellés (intersection), ce qui a
 * réellement rapproché les deux opérations. Vide si l'un des libellés est
 * purement structurel (rapprochement « faible » sur compte+date+montant seuls).
 */
export function sharedSignificantTokens(a: string, b: string): string[] {
  const A = significantTokens(a);
  const B = significantTokens(b);
  const out: string[] = [];
  for (const t of A) if (B.has(t)) out.push(t);
  return out;
}

/** Une ligne candidate à rapprocher (clé contenu + libellé + doublon par hash). */
export interface ContentCandidate {
  key: string;
  label: string;
  hashDuplicate: boolean;
  /** Vrai si la clé contenu a été construite au mois (compte carte différée). */
  monthly?: boolean;
}

/** Une opération déjà en base rapprochée d'une ligne candidate. */
export interface ExistingEntry {
  label: string;
  operation_date: string;
  amount: number;
}

/** Comment une ligne d'aperçu a été détectée comme doublon (détail affichable). */
export interface DuplicateMatch {
  /**
   * - `hash` : ré-import exact (même source) — hash identique.
   * - `content` : rapprochement inter-source (même compte + date/mois + montant,
   *   libellé compatible via au moins un token commun).
   * - `content-weak` : même compte + date/mois + montant, mais aucun token
   *   discriminant commun (libellé structurel) — rapproché « au forceps ».
   */
  kind: "hash" | "content" | "content-weak";
  /** L'opération déjà en base rapprochée (null si hors fenêtre de contenu). */
  existing: ExistingEntry | null;
  /** Tokens discriminants partagés entre les deux libellés. */
  sharedTokens: string[];
  /** Rapprochement effectué à la granularité du mois (compte carte différée). */
  monthly: boolean;
}

/** Copie consommable de `existingContent` par clé contenu. */
function cloneExistingContent(
  existingContent: Map<string, ExistingEntry[]>,
): Map<string, ExistingEntry[]> {
  const remaining = new Map<string, ExistingEntry[]>();
  for (const [k, entries] of existingContent) remaining.set(k, [...entries]);
  return remaining;
}

/**
 * Rapproche chaque ligne candidate d'une opération déjà en base et décrit le
 * détail de la similitude (pour l'affichage), ou `null` si la ligne n'est pas
 * un doublon. Même logique de consommation d'emplacements que
 * `flagContentDuplicates` : chaque opération en base n'est rapprochée qu'une
 * fois, les doublons par hash servant en priorité (1ʳᵉ passe).
 *
 * `existingContent` mappe chaque clé contenu vers les opérations déjà en base
 * (libellé + date + montant), ce qui permet de restituer l'opération rapprochée.
 */
export function matchContentDuplicates(
  candidates: ContentCandidate[],
  existingContent: Map<string, ExistingEntry[]>,
): (DuplicateMatch | null)[] {
  const remaining = cloneExistingContent(existingContent);
  const result = new Array<DuplicateMatch | null>(candidates.length).fill(null);

  // 1ʳᵉ passe : un doublon par hash consomme un emplacement de son contenu.
  // On privilégie l'emplacement au libellé identique (le ré-import exact).
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (!c.hashDuplicate) continue;
    const slots = remaining.get(c.key);
    let existing: ExistingEntry | null = null;
    if (slots && slots.length > 0) {
      const nl = normalizeLabel(c.label);
      let idx = slots.findIndex((e) => normalizeLabel(e.label) === nl);
      if (idx === -1) idx = 0;
      existing = slots[idx];
      slots.splice(idx, 1);
    }
    result[i] = {
      kind: "hash",
      existing,
      sharedTokens: existing ? sharedSignificantTokens(c.label, existing.label) : [],
      monthly: Boolean(c.monthly),
    };
  }

  // 2ᵉ passe : rapprochement inter-source (contenu identique + libellé compatible).
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c.hashDuplicate) continue;
    const slots = remaining.get(c.key);
    if (!slots || slots.length === 0) continue;
    const idx = slots.findIndex((e) => labelsSimilar(e.label, c.label));
    if (idx === -1) continue;
    const existing = slots[idx];
    slots.splice(idx, 1);
    const sharedTokens = sharedSignificantTokens(c.label, existing.label);
    result[i] = {
      kind: sharedTokens.length > 0 ? "content" : "content-weak",
      existing,
      sharedTokens,
      monthly: Boolean(c.monthly),
    };
  }

  return result;
}

/**
 * Marque les doublons « inter-source » d'un lot : au-delà du hash exact (qui
 * assure l'idempotence d'un ré-import de même source), une ligne est un doublon
 * si une opération de même compte + date + montant ET au libellé compatible
 * (`labelsSimilar`) existe déjà en base, même si son `dedup_hash` diffère.
 *
 * Enveloppe booléenne de `matchContentDuplicates`, conservée pour les appels qui
 * n'ont besoin que de l'indicateur (les libellés seuls suffisent).
 */
export function flagContentDuplicates(
  candidates: ContentCandidate[],
  existingContent: Map<string, string[]>,
): boolean[] {
  const entries = new Map<string, ExistingEntry[]>(
    [...existingContent].map(([k, labels]) => [
      k,
      labels.map((label) => ({ label, operation_date: "", amount: 0 })),
    ]),
  );
  return matchContentDuplicates(candidates, entries).map((m) => m !== null);
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
