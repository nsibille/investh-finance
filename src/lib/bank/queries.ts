import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type BankConnection =
  Database["public"]["Tables"]["bank_connections"]["Row"];

export async function getBankConnections(): Promise<BankConnection[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_connections")
    .select("*")
    .order("created_at", { ascending: true });
  return data ?? [];
}
