import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/categories/queries";
import { installmentOccurrence } from "@/lib/purchases/installments";
import type { TransactionShare } from "@/lib/persons/types";
import type {
  Transaction,
  TransactionRow,
  TransactionFilters,
  TransactionsPage,
  TransactionsSummary,
  CategoryDisplay,
  AccountDisplay,
} from "./types";

const DEFAULT_PER_PAGE = 50;

/** Colonnes réellement affichées : on évite de tirer `search_vector`, `dedup_hash`, etc. */
const LIST_COLUMNS =
  "id, account_id, subcategory_id, operation_date, value_date, label, raw_label, amount, currency, status, note, is_recurring, purchase_id, merchant_id, recurring_pattern_id, split_nature" as const;

/** Colonnes du détail : ajoute purchase_id, merchant_id, recurring_pattern_id. */
const DETAIL_COLUMNS =
  "id, account_id, subcategory_id, operation_date, value_date, label, raw_label, amount, currency, status, note, is_recurring, purchase_id, merchant_id, recurring_pattern_id" as const;

type TransactionRecord = Pick<
  Transaction,
  | "id"
  | "account_id"
  | "subcategory_id"
  | "operation_date"
  | "value_date"
  | "label"
  | "raw_label"
  | "amount"
  | "currency"
  | "status"
  | "note"
  | "is_recurring"
>;

/** Enregistrement de liste : base + relations résolues par `attachRelations`. */
type ListRecord = TransactionRecord & {
  purchase_id: string | null;
  merchant_id: string | null;
  recurring_pattern_id: string | null;
  split_nature: Transaction["split_nature"];
};

// Dérivé de l'arbre des catégories (mis en cache) : plus aucune requête
// dédiée, et memoïsé par requête pour être partagé entre les pages.
export const getCategoryDisplayMap = cache(async function getCategoryDisplayMap(): Promise<
  Map<string, CategoryDisplay>
> {
  const tree = await getCategoryTree();
  const out = new Map<string, CategoryDisplay>();
  for (const type of tree) {
    for (const cat of type.categories) {
      for (const sub of cat.subcategories) {
        out.set(sub.id, {
          subcategory_id: sub.id,
          subcategoryName: sub.name,
          categoryName: cat.name,
          typeName: type.name,
          color: cat.color ?? type.color ?? null,
          isIncome: type.is_income,
        });
      }
    }
  }
  return out;
});

export const getAccountDisplayMap = cache(async function getAccountDisplayMap(): Promise<
  Map<string, AccountDisplay>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, color, type");
  return new Map(
    (data ?? []).map((a) => [
      a.id,
      { id: a.id, name: a.name, color: a.color, type: a.type },
    ]),
  );
});

function enrich(
  tx: TransactionRecord,
  accounts: Map<string, AccountDisplay>,
  categories: Map<string, CategoryDisplay>,
): TransactionRow {
  return {
    id: tx.id,
    operation_date: tx.operation_date,
    value_date: tx.value_date,
    label: tx.label,
    raw_label: tx.raw_label,
    amount: Number(tx.amount),
    currency: tx.currency,
    status: tx.status,
    note: tx.note,
    is_recurring: tx.is_recurring,
    subcategory_id: tx.subcategory_id,
    account: tx.account_id ? (accounts.get(tx.account_id) ?? null) : null,
    category: tx.subcategory_id
      ? (categories.get(tx.subcategory_id) ?? null)
      : null,
  };
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Construit la requête `transactions` avec tous les prédicats de filtrage (mais
 * sans tri ni pagination). Partagé par le listing paginé et l'agrégat d'en-tête
 * pour garantir que les KPIs portent exactement sur le même jeu que la liste.
 */
function filteredTransactionsQuery(
  supabase: SupabaseServerClient,
  columns: string,
  filters: TransactionFilters,
) {
  let query = supabase
    .from("transactions")
    .select(columns, { count: "exact" });

  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.subcategoryId)
    query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.merchantIds?.length)
    query = query.in("merchant_id", filters.merchantIds);
  if (filters.purchaseIds?.length)
    query = query.in("purchase_id", filters.purchaseIds);
  // Montant filtré en valeur absolue : les dépenses sont stockées négatives, on
  // veut « entre 10 et 50 € » qu'il s'agisse d'un débit ou d'un crédit.
  const { amountMin: aMin, amountMax: aMax } = filters;
  if (aMin != null && aMax != null) {
    query = query.or(
      `and(amount.gte.${aMin},amount.lte.${aMax}),and(amount.gte.${-aMax},amount.lte.${-aMin})`,
    );
  } else if (aMin != null) {
    query = query.or(`amount.gte.${aMin},amount.lte.${-aMin}`);
  } else if (aMax != null) {
    query = query.gte("amount", -aMax).lte("amount", aMax);
  }
  if (filters.from) query = query.gte("operation_date", filters.from);
  if (filters.to) query = query.lte("operation_date", filters.to);
  if (filters.search) {
    query = query.textSearch("search_vector", filters.search, {
      type: "websearch",
      config: "french",
    });
  }

  return query;
}

/**
 * Agrège le jeu filtré complet (toutes pages) pour l'en-tête du listing : total
 * dépenses/revenus, solde net et nombre d'opérations. Les montants excluent les
 * opérations « ignorées » (non suivies). Parcouru par tranches pour rester juste
 * quel que soit le nombre de lignes.
 */
export async function getTransactionsSummary(
  filters: TransactionFilters,
): Promise<TransactionsSummary> {
  const supabase = await createClient();
  const CHUNK = 1000;
  let offset = 0;
  let count = 0;
  let totalExpense = 0;
  let totalIncome = 0;

  for (;;) {
    // Tri stable (id) indispensable pour paginer sans doublon ni saut.
    const { data, count: c } = await filteredTransactionsQuery(
      supabase,
      "amount, status",
      filters,
    )
      .order("id", { ascending: true })
      .range(offset, offset + CHUNK - 1);

    if (c != null) count = c;
    const rows = (data ?? []) as unknown as { amount: number; status: string }[];
    for (const r of rows) {
      if (r.status === "ignored") continue;
      const amount = Number(r.amount);
      if (amount < 0) totalExpense += -amount;
      else totalIncome += amount;
    }
    if (rows.length < CHUNK) break;
    offset += CHUNK;
  }

  return { count, totalExpense, totalIncome, net: totalIncome - totalExpense };
}

export async function getTransactionsPage(
  filters: TransactionFilters,
): Promise<TransactionsPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? DEFAULT_PER_PAGE;

  let query = filteredTransactionsQuery(supabase, LIST_COLUMNS, filters);

  switch (filters.sort) {
    case "date_asc":
      query = query.order("operation_date", { ascending: true });
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount", { ascending: true });
      break;
    default:
      query = query.order("operation_date", { ascending: false });
  }
  query = query.order("created_at", { ascending: false });
  // Départage final : `operation_date`/`created_at` ne sont pas uniques (un
  // import insère tout un batch avec le même `created_at`). Sans clé unique en
  // dernier critère, Postgres renvoie les ex æquo dans un ordre arbitraire qui
  // peut varier entre deux requêtes. `id` (UUID) rend l'ordre déterministe.
  query = query.order("id", { ascending: false });
  query = query.range((page - 1) * perPage, page * perPage - 1);

  // Les maps de référence ne dépendent pas des lignes : on lance tout en parallèle.
  const [{ data, count }, accounts, categories] = await Promise.all([
    query,
    getAccountDisplayMap(),
    getCategoryDisplayMap(),
  ]);

  const records = (data ?? []) as unknown as ListRecord[];
  const rows = records.map((tx) => enrich(tx, accounts, categories));
  await attachRelations(supabase, records, rows);

  return {
    rows,
    total: count ?? 0,
    page,
    perPage,
  };
}

/**
 * Résout en lot, pour une page de transactions, les noms d'achat / enseigne /
 * récurrente et le résumé du partage entre personnes (nb + nature), afin que la
 * liste dispose du même niveau d'information que l'aperçu d'import.
 */
async function attachRelations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  records: {
    id: string;
    operation_date: string;
    purchase_id: string | null;
    merchant_id: string | null;
    recurring_pattern_id: string | null;
    split_nature: Transaction["split_nature"];
  }[],
  rows: TransactionRow[],
): Promise<void> {
  const uniq = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => Boolean(x)))];
  const purchaseIds = uniq(records.map((r) => r.purchase_id));
  const merchantIds = uniq(records.map((r) => r.merchant_id));
  const recurringIds = uniq(records.map((r) => r.recurring_pattern_id));
  const txWithSplit = records.filter((r) => r.split_nature).map((r) => r.id);
  const allIds = records.map((r) => r.id);

  const [purchases, merchants, recurrings, shares, repayments] = await Promise.all([
    purchaseIds.length
      ? supabase
          .from("purchases")
          .select(
            "id, name, is_recurring, recurrence_end, installments:purchase_installments(month)",
          )
          .in("id", purchaseIds)
      : Promise.resolve({ data: [] }),
    merchantIds.length
      ? supabase.from("merchants").select("id, name").in("id", merchantIds)
      : Promise.resolve({ data: [] }),
    recurringIds.length
      ? supabase.from("recurring_patterns").select("id, name").in("id", recurringIds)
      : Promise.resolve({ data: [] }),
    txWithSplit.length
      ? supabase
          .from("transaction_persons")
          .select(
            "transaction_id, share_amount, persons(id, name, is_self, color)",
          )
          .in("transaction_id", txWithSplit)
      : Promise.resolve({ data: [] }),
    allIds.length
      ? supabase
          .from("person_repayments")
          .select("transaction_id, persons(name)")
          .in("transaction_id", allIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Remboursements liés (crédit → nom de la personne remboursée) par transaction.
  const repaymentByTx = new Map<string, string>();
  for (const r of (repayments.data ?? []) as unknown as {
    transaction_id: string | null;
    persons: { name: string } | null;
  }[]) {
    if (r.transaction_id && r.persons)
      repaymentByTx.set(r.transaction_id, r.persons.name);
  }

  const nameMap = (data: { id: string; name: string }[] | null) =>
    new Map((data ?? []).map((x) => [x.id, x.name]));
  const merchantName = nameMap(merchants.data as { id: string; name: string }[]);
  const recurringName = nameMap(recurrings.data as { id: string; name: string }[]);

  // Achat : nom + mois d'échéancier (triés) + abonnement sans fin, pour dériver
  // l'occurrence X/Y par transaction (mois de l'opération vs mois de départ).
  const purchaseInfo = new Map(
    ((purchases.data ?? []) as {
      id: string;
      name: string;
      is_recurring: boolean;
      recurrence_end: string | null;
      installments: { month: string }[] | null;
    }[]).map((p) => [
      p.id,
      {
        name: p.name,
        months: (p.installments ?? [])
          .map((i) => i.month)
          .sort((a, b) => a.localeCompare(b)),
        endless: !!(p.is_recurring && !p.recurrence_end),
      },
    ]),
  );

  // Parts détaillées par transaction : sert au badge (nb) et au pré-remplissage
  // de l'éditeur de partage depuis la liste (personnes + montants).
  type ShareRecord = {
    transaction_id: string;
    share_amount: number;
    persons: {
      id: string;
      name: string;
      is_self: boolean;
      color: string;
    } | null;
  };
  const sharesByTx = new Map<string, TransactionShare[]>();
  for (const s of (shares.data ?? []) as unknown as ShareRecord[]) {
    const p = s.persons;
    if (!p) continue;
    const list = sharesByTx.get(s.transaction_id) ?? [];
    list.push({
      personId: p.id,
      name: p.name,
      isSelf: p.is_self,
      color: p.color,
      amount: Number(s.share_amount),
    });
    sharesByTx.set(s.transaction_id, list);
  }
  for (const list of sharesByTx.values()) {
    // « Moi » en premier, puis alphabétique (cohérent avec getSharesForTransaction).
    list.sort((a, b) =>
      a.isSelf === b.isSelf ? a.name.localeCompare(b.name) : a.isSelf ? -1 : 1,
    );
  }

  records.forEach((rec, i) => {
    const row = rows[i];
    const pInfo = rec.purchase_id ? purchaseInfo.get(rec.purchase_id) : null;
    if (rec.purchase_id && pInfo) {
      const startMonth = pInfo.months[0] ?? null;
      const txMonth = rec.operation_date.slice(0, 7);
      row.purchase = {
        id: rec.purchase_id,
        name: pInfo.name,
        occurrence: startMonth ? installmentOccurrence(startMonth, txMonth) : null,
        installmentTotal: pInfo.months.length,
        endless: pInfo.endless,
      };
    }
    if (rec.merchant_id && merchantName.has(rec.merchant_id)) {
      row.merchant = { id: rec.merchant_id, name: merchantName.get(rec.merchant_id)! };
    }
    if (rec.recurring_pattern_id && recurringName.has(rec.recurring_pattern_id)) {
      row.recurring = {
        id: rec.recurring_pattern_id,
        name: recurringName.get(rec.recurring_pattern_id)!,
      };
    }
    const shareList = sharesByTx.get(rec.id) ?? [];
    if (rec.split_nature && shareList.length > 0) {
      row.personsSummary = { count: shareList.length, nature: rec.split_nature };
      row.split = { nature: rec.split_nature, shares: shareList };
    }
    const repaidName = repaymentByTx.get(rec.id);
    if (repaidName) row.repayment = { personName: repaidName };
  });
}

export async function getTransaction(
  id: string,
): Promise<TransactionRow | null> {
  const supabase = await createClient();
  const [{ data }, accounts, categories] = await Promise.all([
    supabase.from("transactions").select(DETAIL_COLUMNS).eq("id", id).maybeSingle(),
    getAccountDisplayMap(),
    getCategoryDisplayMap(),
  ]);
  if (!data) return null;
  const row = enrich(data, accounts, categories);
  if (data.purchase_id) {
    const { data: purchase } = await supabase
      .from("purchases")
      .select("id, name")
      .eq("id", data.purchase_id)
      .maybeSingle();
    if (purchase) row.purchase = { id: purchase.id, name: purchase.name };
  }
  if (data.merchant_id) {
    const { data: merchant } = await supabase
      .from("merchants")
      .select("id, name")
      .eq("id", data.merchant_id)
      .maybeSingle();
    // Seules les enseignes nommées sont rattachées à une transaction.
    if (merchant?.name) row.merchant = { id: merchant.id, name: merchant.name };
  }
  if (data.recurring_pattern_id) {
    const { data: rec } = await supabase
      .from("recurring_patterns")
      .select("id, name")
      .eq("id", data.recurring_pattern_id)
      .maybeSingle();
    if (rec) row.recurring = { id: rec.id, name: rec.name };
  }
  return row;
}

export async function countPending(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
