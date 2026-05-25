function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a regex pattern suggestion from a raw label by keeping the leading
 * merchant tokens and dropping the variable tail (amounts, dates, cities…).
 * e.g. "CB CARREFOUR PARIS 12" -> "^CB CARREFOUR PARIS"
 */
export function suggestPattern(rawLabel: string): string {
  const cleaned = rawLabel.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const tokens = cleaned.split(" ");
  const kept: string[] = [];
  for (const token of tokens) {
    if (/\d/.test(token)) break;
    kept.push(token);
    if (kept.length >= 3) break;
  }

  const base = kept.length > 0 ? kept.join(" ") : tokens[0];
  return `^${escapeRegex(base)}`;
}
