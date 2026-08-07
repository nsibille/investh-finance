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
 */
export function contentKey(
  accountId: string,
  operationDate: string,
  amount: number,
): string {
  return `${accountId}|${operationDate}|${amount.toFixed(2)}`;
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

/** Une ligne candidate à rapprocher (clé contenu + libellé + doublon par hash). */
export interface ContentCandidate {
  key: string;
  label: string;
  hashDuplicate: boolean;
}

/**
 * Marque les doublons « inter-source » d'un lot : au-delà du hash exact (qui
 * assure l'idempotence d'un ré-import de même source), une ligne est un doublon
 * si une opération de même compte + date + montant ET au libellé compatible
 * (`labelsSimilar`) existe déjà en base, même si son `dedup_hash` diffère.
 *
 * `existingContent` mappe chaque clé contenu vers les libellés des opérations
 * déjà en base. Chaque emplacement n'est consommé qu'une fois : N lignes
 * candidates ne se rapprochent que des M opérations réellement présentes. Les
 * lignes déjà doublon par hash consomment en priorité un emplacement de leur
 * contenu (1ʳᵉ passe), pour ne pas priver un vrai rapprochement inter-source.
 */
export function flagContentDuplicates(
  candidates: ContentCandidate[],
  existingContent: Map<string, string[]>,
): boolean[] {
  // Copie consommable des libellés existants par clé contenu.
  const remaining = new Map<string, string[]>();
  for (const [k, labels] of existingContent) remaining.set(k, [...labels]);

  const result = new Array<boolean>(candidates.length).fill(false);

  // 1ʳᵉ passe : un doublon par hash consomme un emplacement de son contenu.
  for (let i = 0; i < candidates.length; i++) {
    if (!candidates[i].hashDuplicate) continue;
    result[i] = true;
    const slots = remaining.get(candidates[i].key);
    if (slots && slots.length > 0) slots.shift();
  }

  // 2ᵉ passe : rapprochement inter-source (contenu identique + libellé compatible).
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].hashDuplicate) continue;
    const slots = remaining.get(candidates[i].key);
    if (!slots || slots.length === 0) continue;
    const idx = slots.findIndex((lbl) => labelsSimilar(lbl, candidates[i].label));
    if (idx === -1) continue;
    slots.splice(idx, 1);
    result[i] = true;
  }
  return result;
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
