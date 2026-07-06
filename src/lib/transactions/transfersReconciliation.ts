import { createClient } from "@/lib/supabase/server";
import { getInternalTransferSubcategoryId } from "@/lib/import/transfers";
import { getAccountDisplayMap } from "./queries";
import {
  matchInternalTransfers,
  type TransferCandidate,
} from "./transferMatch";

/** Fenêtre d'appariement par défaut (jours) — cohérente avec l'auto-détection. */
export const TRANSFER_WINDOW_DAYS = 4;
/** Nombre maximum de paires candidates remontées (évite une liste ingérable). */
const MAX_CANDIDATES = 100;
/** Nombre de contreparties suggérées par orphelin. */
const MAX_SUGGESTIONS = 6;

export interface TransferLeg {
  id: string;
  amount: number;
  currency: string;
  operation_date: string;
  label: string;
  raw_label: string;
  /** Vrai si la transaction est déjà catégorisée « Virement interne ». */
  isInternal: boolean;
  account: { id: string; name: string; color: string | null } | null;
}

/** Paire réconciliée : deux jambes partageant un `transfer_group_id`, net = 0. */
export interface TransferPair {
  groupId: string;
  legs: TransferLeg[];
  sum: number;
}

/** Un orphelin + ses contreparties possibles (montant opposé, autre compte). */
export interface Orphan {
  leg: TransferLeg;
  suggestions: TransferLeg[];
}

/** Paire candidate : virement interne probable, non encore catégorisé. */
export interface CandidatePair {
  outLeg: TransferLeg; // sortie (montant < 0)
  inLeg: TransferLeg; // entrée (montant > 0)
}

export interface TransferReconciliation {
  internalSubcategoryId: string | null;
  /** Somme de TOUS les virements internes : doit valoir 0 si tout est équilibré. */
  balance: number;
  currency: string;
  pairs: TransferPair[];
  orphans: Orphan[];
  candidates: CandidatePair[];
  /** Vrai si des candidats ont été tronqués (au-delà de MAX_CANDIDATES). */
  candidatesTruncated: boolean;
}

type Rec = {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  operation_date: string;
  label: string;
  raw_label: string;
  subcategory_id: string | null;
  transfer_group_id: string | null;
  status: string;
};

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.abs(da - db) / 86_400_000;
}

/**
 * Compteur léger (une seule requête) des virements internes orphelins — sans
 * groupe. Sert au badge de l'onglet « Virements » sur toutes les pages
 * transactions, sans exécuter la réconciliation complète.
 */
export async function countTransferOrphans(): Promise<number> {
  const supabase = await createClient();
  const internalId = await getInternalTransferSubcategoryId(supabase);
  if (!internalId) return 0;
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("subcategory_id", internalId)
    .is("transfer_group_id", null)
    .neq("status", "ignored");
  return count ?? 0;
}

/**
 * Construit l'état de réconciliation des virements internes :
 * - `pairs` : les paires déjà appariées (sortie ↔ entrée, net 0) ;
 * - `orphans` : les virements internes sans contrepartie appariée, chacun avec
 *   des suggestions de contrepartie (montant opposé, autre compte) ;
 * - `candidates` : les virements internes probables encore NON catégorisés
 *   (montants opposés sur deux comptes, à quelques jours d'écart) pour n'en
 *   « squeezer » aucun ;
 * - `balance` : la somme de tous les virements internes (doit être 0).
 */
export async function getTransferReconciliation(): Promise<TransferReconciliation> {
  const supabase = await createClient();
  const internalId = await getInternalTransferSubcategoryId(supabase);

  if (!internalId) {
    return {
      internalSubcategoryId: null,
      balance: 0,
      currency: "EUR",
      pairs: [],
      orphans: [],
      candidates: [],
      candidatesTruncated: false,
    };
  }

  const [{ data }, accounts] = await Promise.all([
    supabase
      .from("transactions")
      .select(
        "id, account_id, amount, currency, operation_date, label, raw_label, subcategory_id, transfer_group_id, status",
      )
      .neq("status", "ignored")
      .order("operation_date", { ascending: false }),
    getAccountDisplayMap(),
  ]);

  const records = (data ?? []) as Rec[];

  const toLeg = (r: Rec): TransferLeg => {
    const acc = accounts.get(r.account_id);
    return {
      id: r.id,
      amount: Number(r.amount),
      currency: r.currency,
      operation_date: r.operation_date,
      label: r.label,
      raw_label: r.raw_label,
      isInternal: r.subcategory_id === internalId,
      account: acc ? { id: acc.id, name: acc.name, color: acc.color } : null,
    };
  };

  const internal = records.filter((r) => r.subcategory_id === internalId);
  const currency = internal[0]?.currency ?? "EUR";
  const balance =
    Math.round(internal.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;

  // Regroupement par transfer_group_id : un groupe net 0 (≥ 2 jambes) est une
  // paire ; sinon ses jambes redeviennent des orphelins.
  const groups = new Map<string, Rec[]>();
  const orphanRecs: Rec[] = [];
  for (const r of internal) {
    if (r.transfer_group_id) {
      const list = groups.get(r.transfer_group_id);
      if (list) list.push(r);
      else groups.set(r.transfer_group_id, [r]);
    } else {
      orphanRecs.push(r);
    }
  }

  const pairs: TransferPair[] = [];
  const balancedIds = new Set<string>();
  for (const [groupId, legs] of groups) {
    const sum = Math.round(legs.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
    if (legs.length >= 2 && Math.abs(sum) < 0.005) {
      for (const l of legs) balancedIds.add(l.id);
      pairs.push({
        groupId,
        legs: legs.map(toLeg).sort((a, b) => a.amount - b.amount),
        sum,
      });
    } else {
      orphanRecs.push(...legs);
    }
  }
  pairs.sort((a, b) =>
    (b.legs[0]?.operation_date ?? "").localeCompare(a.legs[0]?.operation_date ?? ""),
  );

  // Index par magnitude des transactions disponibles pour suggérer une
  // contrepartie (tout sauf les jambes déjà réconciliées).
  const available = records.filter((r) => !balancedIds.has(r.id));
  const byMagnitude = new Map<string, Rec[]>();
  for (const r of available) {
    const k = Math.abs(Number(r.amount)).toFixed(2);
    const list = byMagnitude.get(k);
    if (list) list.push(r);
    else byMagnitude.set(k, [r]);
  }

  const orphans: Orphan[] = orphanRecs
    .sort((a, b) => b.operation_date.localeCompare(a.operation_date))
    .map((r) => {
      const mag = Math.abs(Number(r.amount)).toFixed(2);
      const suggestions = (byMagnitude.get(mag) ?? [])
        .filter(
          (c) =>
            c.id !== r.id &&
            c.account_id !== r.account_id &&
            Math.sign(Number(c.amount)) !== Math.sign(Number(r.amount)),
        )
        .sort(
          (x, y) =>
            daysBetween(r.operation_date, x.operation_date) -
            daysBetween(r.operation_date, y.operation_date),
        )
        .slice(0, MAX_SUGGESTIONS)
        .map(toLeg);
      return { leg: toLeg(r), suggestions };
    });

  // Candidats : virements internes probables parmi les transactions NON
  // catégorisées « Virement interne » (montants opposés, 2 comptes, fenêtre).
  // On exclut celles déjà validées avec une autre catégorie : l'utilisateur a
  // tranché, elles ne doivent plus revenir comme virement interne potentiel.
  const pool = records.filter(
    (r) =>
      r.subcategory_id !== internalId &&
      !(r.status === "validated" && r.subcategory_id !== null),
  );
  const poolById = new Map(pool.map((r) => [r.id, r]));
  const candidateInput: TransferCandidate[] = pool.map((r) => ({
    id: r.id,
    account_id: r.account_id,
    amount: Number(r.amount),
    operation_date: r.operation_date,
  }));
  const matched = matchInternalTransfers(candidateInput, TRANSFER_WINDOW_DAYS);

  const allCandidates: CandidatePair[] = [];
  for (const [a, b] of matched) {
    const ra = poolById.get(a);
    const rb = poolById.get(b);
    if (!ra || !rb) continue;
    const legA = toLeg(ra);
    const legB = toLeg(rb);
    // La 1ʳᵉ (a) est la sortie (négative) par construction du matcher.
    allCandidates.push(
      legA.amount < 0
        ? { outLeg: legA, inLeg: legB }
        : { outLeg: legB, inLeg: legA },
    );
  }
  allCandidates.sort((x, y) =>
    y.outLeg.operation_date.localeCompare(x.outLeg.operation_date),
  );
  const candidates = allCandidates.slice(0, MAX_CANDIDATES);

  return {
    internalSubcategoryId: internalId,
    balance,
    currency,
    pairs,
    orphans,
    candidates,
    candidatesTruncated: allCandidates.length > MAX_CANDIDATES,
  };
}
