/**
 * Parse un montant saisi au format français : virgule décimale, espaces (dont
 * insécables), symbole €, signe. Ex. « -5,50 », « 1 234,56 € » → -5.5 / 1234.56.
 * Retourne `NaN` si la chaîne n'est pas un nombre valide (laisse Zod signaler
 * l'erreur via `.finite()`). Un nombre est renvoyé tel quel.
 */
export function parseAmountInput(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const cleaned = value.replace(/[\s €]/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return NaN;
  return Number(cleaned);
}
