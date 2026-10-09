import { createClient } from "@/lib/supabase/server";
import { getInternalTransferSubcategoryId } from "@/lib/import/transfers";
import {
  getDeferredDebitSubcategoryId,
  isDeferredDebit,
} from "@/lib/import/deferred";
import {
  DEFERRED_TOLERANCE,
  type DeferredAccountReconciliation,
  type DeferredLine,
  type DeferredMonth,
  type DeferredMonthStatus,
  type DeferredReconciliation,
} from "./deferredTypes";

/**
 * Réconciliation des cartes à débit différé.
 *
 * Sur un compte `is_deferred_card`, les paiements carte d'un mois sont
 * prélevés en une seule ligne « DEBIT DIFFERE » en fin de mois. Le solde
 * (vue `account_balances`) compte les paiements et ignore le prélèvement ;
 * cet écran vérifie que chaque mois de paiements a bien son prélèvement et
 * que les montants concordent. Association automatique au mois civil : les
 * paiements du mois M ↔ le prélèvement daté du mois M (ou des premiers jours
 * de M+1, cf. `EARLY_DEBIT_DAYS`).
 */

/** Un prélèvement daté du 1er au N du mois solde le mois précédent. */
const EARLY_DEBIT_DAYS = 5;
const CHUNK = 1000;

type Rec = {
  id: string;
  account_id: string;
  operation_date: string;
  label: string;
  raw_label: string;
  amount: number;
  currency: string;
  subcategory_id: string | null;
  transfer_group_id: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function monthOf(date: string): string {
  return date.slice(0, 7);
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Mois soldé par un prélèvement (début de mois → mois précédent). */
function debitMonth(date: string): string {
  const day = Number(date.slice(8, 10));
  return day <= EARLY_DEBIT_DAYS ? prevMonth(monthOf(date)) : monthOf(date);
}

const toLine = (r: Rec): DeferredLine => ({
  id: r.id,
  operation_date: r.operation_date,
  label: r.label,
  amount: Number(r.amount),
});

/**
 * Réconcilie un compte (fonction pure, testable) : `records` = transactions
 * non ignorées du compte, `currentMonth` = YYYY-MM du jour.
 */
export function reconcileDeferredAccount(
  records: Rec[],
  opts: {
    deferredSubId: string | null;
    internalSubId: string | null;
    currentMonth: string;
  },
): Omit<DeferredAccountReconciliation, "account" | "currency"> {
  const debitsByMonth = new Map<string, DeferredLine[]>();
  const opsByMonth = new Map<string, DeferredLine[]>();

  for (const r of records) {
    const isDebit =
      (opts.deferredSubId !== null && r.subcategory_id === opts.deferredSubId) ||
      isDeferredDebit(r.raw_label);
    if (isDebit) {
      const m = debitMonth(r.operation_date);
      const list = debitsByMonth.get(m);
      if (list) list.push(toLine(r));
      else debitsByMonth.set(m, [toLine(r)]);
      continue;
    }
    // Virements (couverture du prélèvement, etc.) : pas des paiements carte.
    if (r.transfer_group_id) continue;
    if (opts.internalSubId !== null && r.subcategory_id === opts.internalSubId) continue;
    const m = monthOf(r.operation_date);
    const list = opsByMonth.get(m);
    if (list) list.push(toLine(r));
    else opsByMonth.set(m, [toLine(r)]);
  }

  const debitMonths = [...debitsByMonth.keys()].sort();
  const empty = {
    months: [] as DeferredMonth[],
    opsTotal: 0,
    debitTotal: 0,
    pending: 0,
    gapTotal: 0,
    missingTotal: 0,
    before: { count: 0, total: 0 },
  };
  if (debitMonths.length === 0) {
    // Aucun prélèvement connu : tout est « en cours » / hors réconciliation.
    const all = [...opsByMonth.values()].flat();
    return {
      ...empty,
      before: { count: all.length, total: round2(all.reduce((s, l) => s + l.amount, 0)) },
    };
  }

  const first = debitMonths[0];
  const opMonths = [...opsByMonth.keys()].sort();
  const last = [opts.currentMonth, debitMonths[debitMonths.length - 1], opMonths[opMonths.length - 1] ?? first]
    .sort()
    .pop() as string;

  let before = { count: 0, total: 0 };
  for (const [m, lines] of opsByMonth) {
    if (m < first) {
      before = {
        count: before.count + lines.length,
        total: before.total + lines.reduce((s, l) => s + l.amount, 0),
      };
    }
  }
  before.total = round2(before.total);

  const months: DeferredMonth[] = [];
  let opsTotal = 0;
  let debitTotal = 0;
  let pending = 0;
  let gapTotal = 0;
  let missingTotal = 0;

  for (let m = first; m <= last; m = nextMonth(m)) {
    const debits = (debitsByMonth.get(m) ?? []).sort((a, b) =>
      a.operation_date.localeCompare(b.operation_date),
    );
    const ops = (opsByMonth.get(m) ?? []).sort((a, b) =>
      b.operation_date.localeCompare(a.operation_date),
    );
    if (debits.length === 0 && ops.length === 0) continue;

    const dTotal = round2(debits.reduce((s, l) => s + l.amount, 0));
    const oTotal = round2(ops.reduce((s, l) => s + l.amount, 0));
    const gap = round2(oTotal - dTotal);

    let status: DeferredMonthStatus;
    if (debits.length === 0) status = m >= opts.currentMonth ? "open" : "missing";
    else status = Math.abs(gap) < DEFERRED_TOLERANCE ? "ok" : "gap";

    opsTotal += oTotal;
    debitTotal += dTotal;
    if (status === "open") pending += oTotal;
    else if (status === "missing") missingTotal += oTotal;
    else gapTotal += gap;

    months.push({ month: m, debits, ops, debitTotal: dTotal, opsTotal: oTotal, gap, status });
  }

  months.reverse();
  return {
    months,
    opsTotal: round2(opsTotal),
    debitTotal: round2(debitTotal),
    pending: round2(pending),
    gapTotal: round2(gapTotal),
    missingTotal: round2(missingTotal),
    before,
  };
}

/** Réconciliation de tous les comptes marqués « carte à débit différé ». */
export async function getDeferredReconciliation(): Promise<DeferredReconciliation> {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, color, currency")
    .eq("is_deferred_card", true)
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  if (!accounts || accounts.length === 0) return { accounts: [] };

  const [deferredSubId, internalSubId] = await Promise.all([
    getDeferredDebitSubcategoryId(supabase),
    getInternalTransferSubcategoryId(supabase),
  ]);

  const records: Rec[] = [];
  for (let offset = 0; ; offset += CHUNK) {
    // Tri stable (id) indispensable pour paginer sans doublon ni saut.
    const { data } = await supabase
      .from("transactions")
      .select(
        "id, account_id, operation_date, label, raw_label, amount, currency, subcategory_id, transfer_group_id",
      )
      .in("account_id", accounts.map((a) => a.id))
      .neq("status", "ignored")
      .order("id", { ascending: true })
      .range(offset, offset + CHUNK - 1);
    const rows = (data ?? []) as Rec[];
    records.push(...rows);
    if (rows.length < CHUNK) break;
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  return {
    accounts: accounts.map((a) => ({
      account: { id: a.id, name: a.name, color: a.color },
      currency: a.currency,
      ...reconcileDeferredAccount(
        records.filter((r) => r.account_id === a.id),
        { deferredSubId, internalSubId, currentMonth },
      ),
    })),
  };
}
