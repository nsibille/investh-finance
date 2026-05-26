import { createClient } from "@/lib/supabase/server";
import type {
  Transaction,
  TransactionRow,
  TransactionFilters,
  TransactionsPage,
  CategoryDisplay,
  AccountDisplay,
} from "./types";

const DEFAULT_PER_PAGE = 50;

export async function getCategoryDisplayMap(): Promise<
  Map<string, CategoryDisplay>
> {
  const supabase = await createClient();
  const [{ data: types }, { data: cats }, { data: subs }] = await Promise.all([
    supabase.from("category_types").select("id, name, is_income, color"),
    supabase.from("categories").select("id, name, color, category_type_id"),
    supabase.from("subcategories").select("id, name, category_id"),
  ]);

  const typeMap = new Map((types ?? []).map((t) => [t.id, t]));
  const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
  const out = new Map<string, CategoryDisplay>();

  for (const sub of subs ?? []) {
    const cat = catMap.get(sub.category_id);
    const type = cat ? typeMap.get(cat.category_type_id) : undefined;
    out.set(sub.id, {
      subcategory_id: sub.id,
      subcategoryName: sub.name,
      categoryName: cat?.name ?? "",
      typeName: type?.name ?? "",
      color: cat?.color ?? type?.color ?? null,
      isIncome: type?.is_income ?? false,
    });
  }
  return out;
}

export async function getAccountDisplayMap(): Promise<
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
}

function enrich(
  tx: Transaction,
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
    .select("*", { count: "exact" });

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

  const { data, count } = await query;

  const [accounts, categories] = await Promise.all([
    getAccountDisplayMap(),
    getCategoryDisplayMap(),
  ]);

  return {
    rows: (data ?? []).map((tx) => enrich(tx, accounts, categories)),
    total: count ?? 0,
    page,
    perPage,
  };
}

export async function getTransaction(
  id: string,
): Promise<TransactionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [accounts, categories] = await Promise.all([
    getAccountDisplayMap(),
    getCategoryDisplayMap(),
  ]);
  return enrich(data, accounts, categories);
}

export async function countPending(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  return count ?? 0;
}
