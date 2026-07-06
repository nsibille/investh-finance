import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type {
  PersonOption,
  TransactionSplit,
  TransactionShare,
  PersonLedger,
  PersonShareRow,
  PersonRepaymentRow,
  PersonManualEntryRow,
  SplitNature,
} from "./types";

/** Options légères (id, nom, moi ?, couleur) pour le sélecteur de personnes. */
export const getPersonOptions = cache(async function getPersonOptions(): Promise<
  PersonOption[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("persons")
    .select("id, name, is_self, color")
    .eq("is_archived", false)
    // « Moi » en premier, puis alphabétique.
    .order("is_self", { ascending: false })
    .order("name", { ascending: true });
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    isSelf: p.is_self,
    color: p.color,
  }));
});

/** Ventilation d'une transaction : nature globale + parts par personne. */
export async function getSharesForTransaction(
  transactionId: string,
): Promise<TransactionSplit> {
  const supabase = await createClient();
  const [{ data: tx }, { data: rows }] = await Promise.all([
    supabase
      .from("transactions")
      .select("split_nature")
      .eq("id", transactionId)
      .maybeSingle(),
    supabase
      .from("transaction_persons")
      .select("share_amount, persons(id, name, is_self, color)")
      .eq("transaction_id", transactionId),
  ]);

  const shares: TransactionShare[] = [];
  for (const r of rows ?? []) {
    const p = r.persons as unknown as {
      id: string;
      name: string;
      is_self: boolean;
      color: string;
    } | null;
    if (!p) continue;
    shares.push({
      personId: p.id,
      name: p.name,
      isSelf: p.is_self,
      color: p.color,
      amount: Number(r.share_amount),
    });
  }
  // « Moi » en premier, puis alphabétique.
  shares.sort((a, b) =>
    a.isSelf === b.isSelf ? a.name.localeCompare(b.name) : a.isSelf ? -1 : 1,
  );

  return { nature: (tx?.split_nature as SplitNature | null) ?? null, shares };
}

/**
 * Ajustements des dépenses perso pour le budget/analytics :
 * - `debtByTx` : montant "dette" (personnes ≠ moi) à réintégrer à une dépense
 *   négative pour ne garder que ma part (+ les cadeaux).
 * - `repaymentTxIds` : transactions rattachées à un remboursement, à exclure des
 *   revenus (elles n'annuleraient sinon la créance déjà déduite → double compte).
 * Mémoïsé par requête (petites tables, réutilisé par plusieurs vues).
 */
export const getPersonalAmountAdjustments = cache(
  async function getPersonalAmountAdjustments(): Promise<{
    debtByTx: Map<string, number>;
    repaymentTxIds: Set<string>;
  }> {
    const supabase = await createClient();
    const [{ data: adj }, { data: reps }] = await Promise.all([
      supabase
        .from("transaction_debt_adjustments")
        .select("transaction_id, debt_amount"),
      supabase
        .from("person_repayments")
        .select("transaction_id")
        .not("transaction_id", "is", null),
    ]);

    const debtByTx = new Map<string, number>();
    for (const r of adj ?? []) {
      if (r.transaction_id)
        debtByTx.set(r.transaction_id, Number(r.debt_amount ?? 0));
    }
    const repaymentTxIds = new Set<string>();
    for (const r of reps ?? []) {
      if (r.transaction_id) repaymentTxIds.add(r.transaction_id);
    }
    return { debtByTx, repaymentTxIds };
  },
);

export interface CreditCandidate {
  id: string;
  label: string;
  operationDate: string;
  amount: number;
}

/**
 * Transactions créditées (montant > 0, validées) récentes non encore utilisées
 * comme remboursement : candidates au rattachement d'un remboursement.
 */
export async function getCreditCandidates(): Promise<CreditCandidate[]> {
  const supabase = await createClient();
  const [{ data: txs }, { data: used }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, label, operation_date, amount")
      .gt("amount", 0)
      .order("operation_date", { ascending: false })
      .limit(80),
    supabase
      .from("person_repayments")
      .select("transaction_id")
      .not("transaction_id", "is", null),
  ]);
  const usedIds = new Set((used ?? []).map((u) => u.transaction_id));
  return (txs ?? [])
    .filter((t) => !usedIds.has(t.id))
    .map((t) => ({
      id: t.id,
      label: t.label,
      operationDate: t.operation_date,
      amount: Number(t.amount),
    }));
}

/**
 * Registre complet par personne pour la page « Personnes » : soldes agrégés
 * (vue `person_balances`) + parts dette/cadeau détaillées + remboursements.
 */
export async function getPersonsLedger(): Promise<PersonLedger[]> {
  const supabase = await createClient();
  const [{ data: balances }, { data: shareRows }, { data: repRows }, { data: manualRows }] =
    await Promise.all([
      supabase
        .from("person_balances")
        .select(
          "person_id, name, is_self, color, is_archived, total_debt, total_gift, total_repaid, outstanding_debt",
        )
        .order("is_self", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("transaction_persons")
        .select(
          "person_id, share_amount, transactions!inner(id, label, operation_date, amount, split_nature)",
        ),
      supabase
        .from("person_repayments")
        .select("id, person_id, amount, repaid_on, note, transaction_id, transactions(label)")
        .order("repaid_on", { ascending: false }),
      supabase
        .from("person_manual_entries")
        .select("id, person_id, nature, amount, entry_date, label, note")
        .order("entry_date", { ascending: false }),
    ]);

  const sharesByPerson = new Map<string, PersonShareRow[]>();
  for (const r of shareRows ?? []) {
    const tx = r.transactions as unknown as {
      id: string;
      label: string;
      operation_date: string;
      amount: number;
      split_nature: SplitNature | null;
    } | null;
    if (!tx || !tx.split_nature) continue; // parts sans nature = non ventilées
    const list = sharesByPerson.get(r.person_id) ?? [];
    list.push({
      transactionId: tx.id,
      label: tx.label,
      operationDate: tx.operation_date,
      amount: Number(tx.amount),
      shareAmount: Number(r.share_amount),
      nature: tx.split_nature,
    });
    sharesByPerson.set(r.person_id, list);
  }
  for (const list of sharesByPerson.values()) {
    list.sort((a, b) => (a.operationDate < b.operationDate ? 1 : -1));
  }

  const repsByPerson = new Map<string, PersonRepaymentRow[]>();
  for (const r of repRows ?? []) {
    const tx = r.transactions as unknown as { label: string } | null;
    const list = repsByPerson.get(r.person_id) ?? [];
    list.push({
      id: r.id,
      amount: Number(r.amount),
      repaidOn: r.repaid_on,
      note: r.note,
      transactionId: r.transaction_id,
      transactionLabel: tx?.label ?? null,
    });
    repsByPerson.set(r.person_id, list);
  }

  const manualByPerson = new Map<string, PersonManualEntryRow[]>();
  for (const r of manualRows ?? []) {
    const list = manualByPerson.get(r.person_id) ?? [];
    list.push({
      id: r.id,
      nature: r.nature,
      amount: Number(r.amount),
      entryDate: r.entry_date,
      label: r.label,
      note: r.note,
    });
    manualByPerson.set(r.person_id, list);
  }

  return (balances ?? []).map((b) => ({
    id: b.person_id as string,
    name: b.name ?? "—",
    isSelf: b.is_self ?? false,
    color: b.color ?? "#5B5BD6",
    isArchived: b.is_archived ?? false,
    totalDebt: Number(b.total_debt ?? 0),
    totalGift: Number(b.total_gift ?? 0),
    totalRepaid: Number(b.total_repaid ?? 0),
    outstandingDebt: Number(b.outstanding_debt ?? 0),
    shares: b.is_self ? [] : (sharesByPerson.get(b.person_id as string) ?? []),
    repayments: b.is_self ? [] : (repsByPerson.get(b.person_id as string) ?? []),
    manualEntries: b.is_self ? [] : (manualByPerson.get(b.person_id as string) ?? []),
  }));
}

/**
 * Registre d'une seule personne (page `/personnes/[id]`) : réutilise le
 * registre complet (app mono-utilisateur, volume modeste) puis filtre.
 */
export async function getPersonLedger(id: string): Promise<PersonLedger | null> {
  const all = await getPersonsLedger();
  return all.find((p) => p.id === id) ?? null;
}

/**
 * Fusionne les événements d'une personne (parts de transactions, dettes/cadeaux
 * manuels, remboursements) en une timeline unique triée du plus récent au plus
 * ancien, pour la page de détail.
 */
export function buildPersonEvents(
  ledger: PersonLedger,
): import("./types").PersonEvent[] {
  const events: import("./types").PersonEvent[] = [];
  for (const s of ledger.shares) {
    events.push({
      kind: "share",
      id: s.transactionId,
      date: s.operationDate,
      nature: s.nature,
      amount: s.shareAmount,
      transactionId: s.transactionId,
      label: s.label,
    });
  }
  for (const m of ledger.manualEntries) {
    events.push({
      kind: "manual",
      id: m.id,
      date: m.entryDate,
      nature: m.nature,
      amount: m.amount,
      label: m.label,
      note: m.note,
    });
  }
  for (const r of ledger.repayments) {
    events.push({
      kind: "repayment",
      id: r.id,
      date: r.repaidOn,
      amount: r.amount,
      note: r.note,
      transactionId: r.transactionId,
      label: r.transactionLabel,
    });
  }
  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
