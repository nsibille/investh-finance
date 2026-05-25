/** "30/04/2026" -> "2026-04-30" */
export function frDateToISO(d: string): string {
  const [dd, mm, yyyy] = d.split("/");
  return `${yyyy}-${mm}-${dd}`;
}

export function cleanLabel(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** BforBank-style amount: space thousands + comma decimals, e.g. "4 572,57" / "-55,90". */
export function parseAmountSpaces(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", "."));
}

/** SG-style amount: dot thousands + comma decimals, e.g. "2.000,00". */
export function parseAmountDots(s: string): number {
  return parseFloat(s.replace(/[.\s]/g, "").replace(",", "."));
}
