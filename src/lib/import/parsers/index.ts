import type { ParsedTransaction } from "@/lib/import/types";
import { detectBank } from "./detect";
import { parseBforBank } from "./bforbank";
import { parseSocieteGenerale } from "./societegenerale";
import type { BankId, ParsedStatement } from "./types";

export { detectBank } from "./detect";
export { BANK_LABELS } from "./types";
export type { BankId, ParsedStatement } from "./types";

const PARSERS: Record<BankId, (text: string) => ParsedTransaction[]> = {
  bforbank: parseBforBank,
  societegenerale: parseSocieteGenerale,
};

/** Detects the bank and parses the statement text into transactions. */
export function parseStatementText(text: string): ParsedStatement | null {
  const bank = detectBank(text);
  if (!bank) return null;
  return { bank, transactions: PARSERS[bank](text) };
}
