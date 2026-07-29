import { createClient } from "@/lib/supabase/server";
import type { Account, AccountWithBalance, AccountRebase } from "./types";

/** Rebasements d'un compte, du plus récent au plus ancien. */
export async function getAccountRebases(
  accountId: string,
): Promise<AccountRebase[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_rebases")
    .select("*")
    .eq("account_id", accountId)
    .order("rebase_date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as AccountRebase[];
}

export async function getAccountsWithBalances(): Promise<AccountWithBalance[]> {
  const supabase = await createClient();

  const [{ data: accounts }, { data: balances }] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("account_balances").select("*"),
  ]);

  const balanceMap = new Map(
    (balances ?? []).map((b) => [b.account_id, b]),
  );

  return (accounts ?? []).map((account: Account) => {
    const b = balanceMap.get(account.id);
    return {
      ...account,
      current_balance: Number(b?.current_balance ?? account.initial_balance),
      transactions_sum: Number(b?.transactions_sum ?? 0),
      pending_count: Number(b?.pending_count ?? 0),
    };
  });
}

export async function getAccount(
  id: string,
): Promise<AccountWithBalance | null> {
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!account) return null;

  const { data: balance } = await supabase
    .from("account_balances")
    .select("*")
    .eq("account_id", id)
    .maybeSingle();

  return {
    ...account,
    current_balance: Number(balance?.current_balance ?? account.initial_balance),
    transactions_sum: Number(balance?.transactions_sum ?? 0),
    pending_count: Number(balance?.pending_count ?? 0),
  };
}
