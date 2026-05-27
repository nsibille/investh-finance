import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Rule =
  Database["public"]["Tables"]["categorization_rules"]["Row"];

export async function getRules(): Promise<Rule[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categorization_rules")
    .select("*")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });
  return data ?? [];
}

export interface AccountOption {
  id: string;
  name: string;
}

export async function getAccountOptions(): Promise<AccountOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("is_archived", false)
    .order("name", { ascending: true });
  return data ?? [];
}
