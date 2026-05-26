"use server";

import { createClient } from "@/lib/supabase/server";

export interface SearchResults {
  transactions: {
    id: string;
    label: string;
    amount: number;
    date: string;
    accountName: string | null;
  }[];
  accounts: { id: string; name: string }[];
}

export async function searchEverything(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 2) return { transactions: [], accounts: [] };

  const supabase = await createClient();

  const [{ data: txs }, { data: accounts }] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, label, amount, operation_date, accounts!transactions_account_id_fkey(name)")
      .textSearch("search_vector", q, { type: "websearch", config: "french" })
      .order("operation_date", { ascending: false })
      .limit(8),
    supabase.from("accounts").select("id, name").ilike("name", `%${q}%`).limit(5),
  ]);

  return {
    transactions: (txs ?? []).map((t) => {
      const acc = t.accounts as { name: string } | { name: string }[] | null;
      const accountName = Array.isArray(acc) ? (acc[0]?.name ?? null) : (acc?.name ?? null);
      return {
        id: t.id,
        label: t.label,
        amount: Number(t.amount),
        date: t.operation_date,
        accountName,
      };
    }),
    accounts: accounts ?? [],
  };
}
