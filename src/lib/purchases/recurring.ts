import { createClient } from "@/lib/supabase/server";
import { enumerateMonths, addMonthsToYM } from "./installments";

/** Mois générés en avance pour un abonnement sans fin (horizon glissant). */
const HORIZON_AHEAD = 2;

function currentYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Génère les mensualités concrètes manquantes des achats récurrents :
 * - fin définie (loyer, engagement) → tous les mois start..fin ;
 * - sans fin (abonnement) → jusqu'à l'horizon glissant (mois courant + N),
 *   étendu à chaque appel (import, chargement de la page Achats).
 * Idempotent : n'insère que les mois absents.
 */
export async function ensureRecurringInstallments(): Promise<void> {
  const supabase = await createClient();
  const { data: purchases } = await supabase
    .from("purchases")
    .select(
      "id, is_recurring, recurrence_amount, recurrence_start, recurrence_end, recurrence_label",
    )
    .eq("is_recurring", true);
  if (!purchases || purchases.length === 0) return;

  const horizon = addMonthsToYM(currentYM(), HORIZON_AHEAD);

  for (const p of purchases) {
    if (!p.recurrence_start || p.recurrence_amount == null) continue;
    const startYM = p.recurrence_start.slice(0, 7);
    const endYM = p.recurrence_end ? p.recurrence_end.slice(0, 7) : horizon;
    const months = enumerateMonths(startYM, endYM);
    if (months.length === 0) continue;

    const { data: existing } = await supabase
      .from("purchase_installments")
      .select("month")
      .eq("purchase_id", p.id);
    const have = new Set((existing ?? []).map((e) => e.month.slice(0, 7)));

    const rows = months
      .filter((m) => !have.has(m.slice(0, 7)))
      .map((m) => ({
        purchase_id: p.id,
        month: m,
        amount: p.recurrence_amount as number,
        label: p.recurrence_label,
      }));
    if (rows.length > 0) {
      await supabase.from("purchase_installments").insert(rows);
    }
  }
}
