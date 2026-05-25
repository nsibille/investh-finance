import type { Database } from "@/types/database.types";

export type Account = Database["public"]["Tables"]["accounts"]["Row"];

export interface AccountWithBalance extends Account {
  current_balance: number;
  transactions_sum: number;
  pending_count: number;
}
