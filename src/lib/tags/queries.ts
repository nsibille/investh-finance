import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type Tag = Database["public"]["Tables"]["tags"]["Row"];

export async function getTags(): Promise<Tag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("*")
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getTagsForTransaction(
  transactionId: string,
): Promise<Tag[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transaction_tags")
    .select("tags(*)")
    .eq("transaction_id", transactionId);
  return (data ?? [])
    .map((r) => r.tags as Tag | null)
    .filter((t): t is Tag => t !== null);
}
