import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function toDate(value: string | Date): Date {
  return typeof value === "string" ? parseISO(value) : value;
}

/** ex: 25 mai 2026 */
export function formatDate(value: string | Date): string {
  return format(toDate(value), "d MMM yyyy", { locale: fr });
}

/** ex: 25/05/2026 */
export function formatShortDate(value: string | Date): string {
  return format(toDate(value), "dd/MM/yyyy", { locale: fr });
}

/** ex: Mai 2026 (pour le sélecteur de mois) */
export function formatMonthLabel(value: string | Date): string {
  return format(toDate(value), "MMMM yyyy", { locale: fr });
}

/** ex: mai 26 (compact, listes d'échéances) */
export function formatShortMonth(value: string | Date): string {
  return format(toDate(value), "MMM yy", { locale: fr });
}
