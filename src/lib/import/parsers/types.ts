import type { ParsedTransaction } from "@/lib/import/types";

export type BankId = "bforbank" | "societegenerale";

export const BANK_LABELS: Record<BankId, string> = {
  bforbank: "BforBank",
  societegenerale: "Société Générale",
};

export interface ParsedStatement {
  bank: BankId;
  transactions: ParsedTransaction[];
}
