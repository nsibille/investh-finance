const currencyFormatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatters.set(currency, formatter);
  }
  return formatter;
}

/** Formate un montant en devise locale fr-FR, ex: 1 234,56 €. */
export function formatCurrency(amount: number, currency = "EUR"): string {
  return getFormatter(currency).format(amount);
}

/** Format compact pour les axes de graphiques, ex: 1,2 k €. */
export function formatCompactCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}
