function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Boilerplate that French bank statements prepend before the actual merchant.
// Longest first so "PAIEMENT PAR CARTE WEB" wins over "PAIEMENT PAR CARTE".
const BOILERPLATE_PREFIXES = [
  "PAIEMENT PAR CARTE SANS CONTACT WEB",
  "PAIEMENT PAR CARTE SANS CONTACT",
  "PAIEMENT PAR CARTE WEB",
  "PAIEMENT PAR CARTE",
  "PRELEVEMENT EUROPEEN",
  "PRELEVEMENT",
  "VIREMENT EN VOTRE FAVEUR",
  "VIREMENT INSTANTANE",
  "VIREMENT",
  "RETRAIT DAB",
  "RETRAIT",
];

/**
 * Builds a regex pattern suggestion from a raw label by skipping the generic
 * bank boilerplate (e.g. "PAIEMENT PAR CARTE"), then keeping the leading
 * merchant tokens and dropping the variable tail (amounts, dates, cities…).
 * e.g. "PAIEMENT PAR CARTE MC DONALDS FRNEUILLY 220126" ->
 *      "^PAIEMENT PAR CARTE MC DONALDS FRNEUILLY"
 */
export function suggestPattern(rawLabel: string): string {
  const cleaned = rawLabel.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const upper = cleaned.toUpperCase();
  const prefix = BOILERPLATE_PREFIXES.find(
    (p) => upper === p || upper.startsWith(p + " "),
  );
  const rest = prefix ? cleaned.slice(prefix.length).trim() : cleaned;

  const tokens = rest.split(" ");
  const kept: string[] = [];
  for (const token of tokens) {
    if (/\d/.test(token)) break;
    kept.push(token);
    if (kept.length >= 3) break;
  }

  const merchant = kept.length > 0 ? kept.join(" ") : (tokens[0] ?? "");
  const base = [prefix, merchant].filter(Boolean).join(" ");
  return base ? `^${escapeRegex(base)}` : "";
}

/**
 * Builds an anchored regex matching the whole label (whitespace normalised),
 * used as the default suggestion when creating a rule from a transaction.
 */
export function fullPattern(rawLabel: string): string {
  const cleaned = rawLabel.replace(/\s+/g, " ").trim();
  return cleaned ? `^${escapeRegex(cleaned)}` : "";
}
