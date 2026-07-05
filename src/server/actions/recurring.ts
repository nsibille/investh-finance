"use server";

import { revalidatePath } from "next/cache";
import { subMonths, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { recurringSchema, type RecurringInput } from "@/lib/recurring/schema";
import {
  detectRecurringCandidates,
  type RecurringCandidate,
} from "@/lib/recurring/detector";
import type { Database } from "@/types/database.types";

type RecurringRow =
  Database["public"]["Tables"]["recurring_patterns"]["Insert"];

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(m: string): ActionResult {
  return { ok: false, error: m };
}

function revalidate() {
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
}

function toRow(
  input: RecurringInput,
): { ok: false; error: string } | { ok: true; row: RecurringRow } {
  const parsed = recurringSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalide" };
  }
  const { label_pattern, ...rest } = parsed.data;
  return {
    ok: true,
    row: { ...rest, label_pattern: label_pattern ? label_pattern : null },
  };
}

export async function createRecurringPattern(
  input: RecurringInput,
): Promise<ActionResult> {
  const res = toRow(input);
  if (!res.ok) return fail(res.error);
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_patterns").insert(res.row);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function updateRecurringPattern(
  id: string,
  input: RecurringInput,
): Promise<ActionResult> {
  const res = toRow(input);
  if (!res.ok) return fail(res.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_patterns")
    .update(res.row)
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function setRecurringActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_patterns")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function deleteRecurringPattern(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_patterns")
    .delete()
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

/** Ligne d'aperçu d'import (transaction pas encore importée). */
export interface DetectImportRow {
  raw_label: string;
  amount: number;
  operation_date: string;
}

/**
 * Détecte des récurrences dans les transactions validées existantes et,
 * optionnellement, dans les lignes de l'aperçu d'import en cours (`importRows`)
 * pour les créer à la volée. Dédupe contre les modèles existants (par libellé).
 */
export async function detectRecurring(
  importRows?: DetectImportRow[],
): Promise<RecurringCandidate[]> {
  const supabase = await createClient();
  const since = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const { data } = await supabase
    .from("transactions")
    .select("account_id, raw_label, amount, operation_date")
    .eq("status", "validated")
    .gte("operation_date", since);

  const dbCandidates = detectRecurringCandidates(
    (data ?? []).map((t) => ({
      account_id: t.account_id,
      raw_label: t.raw_label,
      amount: Number(t.amount),
      operation_date: t.operation_date,
    })),
  );

  // Aperçu d'import : compte inconnu (multi-comptes) → account_id vide, la
  // récurrente créée sera « tous comptes ».
  const importCandidates = importRows?.length
    ? detectRecurringCandidates(
        importRows.map((r) => ({
          account_id: "",
          raw_label: r.raw_label,
          amount: Number(r.amount),
          operation_date: r.operation_date,
        })),
      )
    : [];

  // Dédup par libellé (modèles existants + entre sources DB/import).
  const { data: existing } = await supabase
    .from("recurring_patterns")
    .select("label_pattern");
  const covered = new Set(
    (existing ?? []).map((p) => (p.label_pattern ?? "").toUpperCase()),
  );
  const seen = new Set<string>();
  const out: RecurringCandidate[] = [];
  for (const c of [...dbCandidates, ...importCandidates]) {
    const key = c.label_pattern.toUpperCase();
    if (!key || covered.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

export async function createFromCandidate(
  candidate: RecurringCandidate,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("recurring_patterns").insert({
    name: candidate.name,
    account_id: candidate.account_id || null,
    expected_amount: candidate.expected_amount,
    frequency_days: candidate.frequency_days,
    label_pattern: candidate.label_pattern,
    last_seen_at: candidate.last_seen_at,
    alert_if_missing: true,
  });
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}
