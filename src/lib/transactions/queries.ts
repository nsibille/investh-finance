import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree } from "@/lib/categories/queries";
import type {
  Transaction,
  TransactionRow,
  TransactionFilters,
  TransactionsPage,
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

export async function getTransactionsPage(
  filters: TransactionFilters,
): Promise<TransactionsPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = filters.perPage ?? DEFAULT_PER_PAGE;

  let query = supabase
    .from("transactions")
    .select(LIST_COLUMNS, { count: "exact" });

  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.subcategoryId)
    query = query.eq("subcategory_id", filters.subcategoryId);
  if (filters.from) query = query.gte("operation_date", filters.from);
  if (filters.to) query = query.lte("operation_date", filters.to);
  if (filters.search) {
    query = query.textSearch("search_vector", filters.search, {
      type: "websearch",
      config: "french",
    });
  }

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

  const [purchases, merchants, recurrings, shares] = await Promise.all([
    purchaseIds.length
      ? supabase.from("purchases").select("id, name").in("id", purchaseIds)
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
          .select("transaction_id")
          .in("transaction_id", txWithSplit)
      : Promise.resolve({ data: [] }),
  ]);

  const nameMap = (data: { id: string; name: string }[] | null) =>
    new Map((data ?? []).map((x) => [x.id, x.name]));
  const purchaseName = nameMap(purchases.data as { id: string; name: string }[]);
  const merchantName = nameMap(merchants.data as { id: string; name: string }[]);
  const recurringName = nameMap(recurrings.data as { id: string; name: string }[]);

  const shareCount = new Map<string, number>();
  for (const s of (shares.data ?? []) as { transaction_id: string }[]) {
    shareCount.set(s.transaction_id, (shareCount.get(s.transaction_id) ?? 0) + 1);
  }

  records.forEach((rec, i) => {
    const row = rows[i];
    if (rec.purchase_id && purchaseName.has(rec.purchase_id)) {
      row.purchase = { id: rec.purchase_id, name: purchaseName.get(rec.purchase_id)! };
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
    const count = shareCount.get(rec.id) ?? 0;
    if (rec.split_nature && count > 0) {
      row.personsSummary = { count, nature: rec.split_nature };
    }
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
    if (merchant) row.merchant = { id: merchant.id, name: merchant.name };
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
