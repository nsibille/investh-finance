import type { BankId } from "./types";

export function detectBank(text: string): BankId | null {
  // Check SG first: a BforBank statement never mentions SG, but an SG
  // statement can contain "BFBKFRP1XXX" (a transfer to a BforBank account).
  if (/Soci[ée]t[ée] G[ée]n[ée]rale|SOGEFRPP|RELEV[ÉE] DES OP[ÉE]RATIONS/i.test(text)) {
    return "societegenerale";
  }
  if (/BforBank/i.test(text)) return "bforbank";
  return null;
}
