"use server";

import { revalidatePath } from "next/cache";
import { subMonths, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { recurringSchema, type RecurringInput } from "@/lib/recurring/schema";
import {
  detectRecurringCandidates,
  recurringKey,
  type RecurringCandidate,
} from "@/lib/recurring/detector";
import { matchesPattern, labelPatterns } from "@/lib/recurring/checker";
import type { Database } from "@/types/database.types";

/** Candidat détecté : soit nouveau, soit correspondant à une règle existante. */
export interface DetectedRecurring extends RecurringCandidate {
  /** Id du modèle existant si le libellé correspond déjà à une règle. */
  existingPatternId: string | null;
}

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
 * optionnellement, dans les lignes de l'aperçu d'import (`importRows`).
 *
 * - Libellé correspondant à un modèle existant → renvoyé avec `existingPatternId`
 *   (règle détectée : le bouton sert à l'assigner aux transactions concernées).
 * - Sinon → nouveau candidat (`existingPatternId: null`) à créer.
 */
export async function detectRecurring(
  importRows?: DetectImportRow[],
): Promise<DetectedRecurring[]> {
  const supabase = await createClient();
  const since = format(subMonths(new Date(), 6), "yyyy-MM-dd");
  const [{ data: validated }, { data: patterns }, { data: unlinked }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("account_id, raw_label, amount, operation_date")
        .eq("status", "validated")
        .gte("operation_date", since),
      supabase.from("recurring_patterns").select("*"),
      supabase
        .from("transactions")
        .select("account_id, raw_label, amount, operation_date")
        .is("recurring_pattern_id", null)
        .neq("status", "ignored")
        .gte("operation_date", since),
    ]);

  // Nouveaux candidats (transactions validées + aperçu d'import).
  const dbCandidates = detectRecurringCandidates(
    (validated ?? []).map((t) => ({
      account_id: t.account_id,
      raw_label: t.raw_label,
      amount: Number(t.amount),
      operation_date: t.operation_date,
    })),
  );
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

  const covered = new Set(
    (patterns ?? []).map((p) => (p.label_pattern ?? "").toUpperCase()),
  );
  const seen = new Set<string>();
  const news: DetectedRecurring[] = [];
  for (const c of [...dbCandidates, ...importCandidates]) {
    const key = c.label_pattern.toUpperCase();
    if (!key || covered.has(key) || seen.has(key)) continue;
    seen.add(key);
    news.push({ ...c, existingPatternId: null });
  }

  // Règles existantes ayant des transactions non encore rattachées à assigner.
  const detected: DetectedRecurring[] = [];
  for (const p of patterns ?? []) {
    if (!p.label_pattern) continue;
    const matches = (unlinked ?? []).filter((t) =>
      matchesPattern(p, {
        account_id: t.account_id,
        raw_label: t.raw_label,
        amount: Number(t.amount),
        operation_date: t.operation_date,
      }),
    );
    if (matches.length === 0) continue;
    const last = matches.reduce(
      (m, t) => (t.operation_date > m ? t.operation_date : m),
      matches[0].operation_date,
    );
    detected.push({
      existingPatternId: p.id,
      account_id: p.account_id ?? "",
      label_pattern: p.label_pattern,
      name: p.name,
      expected_amount: p.expected_amount ?? 0,
      frequency_days: p.frequency_days,
      occurrences: matches.length,
      last_seen_at: last,
    });
  }

  return [...detected, ...news];
}

/**
 * Assigne un modèle récurrent aux transactions correspondantes non encore
 * rattachées : `recurring_pattern_id`, catégorie et enseigne du modèle (si
 * définies), et met à jour la dernière occurrence vue. Retourne le nombre de
 * transactions rattachées.
 */
export async function applyRecurringPattern(
  patternId: string,
): Promise<{ ok: true; applied: number; ids: string[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("recurring_patterns")
    .select("*")
    .eq("id", patternId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Récurrente introuvable" };

  const since = format(subMonths(new Date(), 12), "yyyy-MM-dd");
  const { data: txs } = await supabase
    .from("transactions")
    .select("id, account_id, raw_label, amount, operation_date, subcategory_id")
    .is("recurring_pattern_id", null)
    .neq("status", "ignored")
    .gte("operation_date", since);

  const matches = (txs ?? []).filter((t) =>
    matchesPattern(p, {
      account_id: t.account_id,
      raw_label: t.raw_label,
      amount: Number(t.amount),
      operation_date: t.operation_date,
    }),
  );
  if (matches.length === 0) return { ok: true, applied: 0, ids: [] };

  const nowIso = new Date().toISOString();
  const CHUNK = 200;
  const allIds = matches.map((m) => m.id);
  const base: Database["public"]["Tables"]["transactions"]["Update"] = {
    recurring_pattern_id: patternId,
    is_recurring: true,
  };
  if (p.merchant_id) base.merchant_id = p.merchant_id;
  for (let i = 0; i < allIds.length; i += CHUNK) {
    await supabase.from("transactions").update(base).in("id", allIds.slice(i, i + CHUNK));
  }
  // Catégorie du modèle appliquée aux transactions non catégorisées.
  if (p.subcategory_id) {
    const uncat = matches.filter((m) => !m.subcategory_id).map((m) => m.id);
    for (let i = 0; i < uncat.length; i += CHUNK) {
      await supabase
        .from("transactions")
        .update({ subcategory_id: p.subcategory_id, status: "validated", validated_at: nowIso })
        .in("id", uncat.slice(i, i + CHUNK));
    }
  }
  // Rafraîchit la dernière occurrence vue (résout le statut « Manquante »).
  const last = matches.reduce(
    (m, t) => (t.operation_date > m ? t.operation_date : m),
    matches[0].operation_date,
  );
  await supabase
    .from("recurring_patterns")
    .update({ last_seen_at: last })
    .eq("id", patternId);

  revalidate();
  revalidatePath("/transactions");
  return { ok: true, applied: allIds.length, ids: allIds };
}

/**
 * Associe une transaction à une récurrente depuis un écran de transaction :
 * ajoute le motif du libellé de la transaction à la récurrente, hérite de sa
 * catégorie et de son enseigne, et applique la récurrente à toutes les
 * transactions correspondantes. Retourne de quoi annuler.
 */
export async function associateTransactionToRecurring(
  transactionId: string,
  recurringId: string,
): Promise<
  | { ok: true; applied: number; addedLabel: string | null; ids: string[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: tx } = await supabase
    .from("transactions")
    .select("id, raw_label")
    .eq("id", transactionId)
    .maybeSingle();
  if (!tx) return { ok: false, error: "Transaction introuvable" };
  const { data: p } = await supabase
    .from("recurring_patterns")
    .select("label_pattern")
    .eq("id", recurringId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Récurrente introuvable" };

  // Ajoute le motif (libellé sans les chiffres, robuste aux variantes).
  const key = recurringKey(tx.raw_label);
  const existing = labelPatterns(p.label_pattern);
  let addedLabel: string | null = null;
  if (key && !existing.some((l) => l.toUpperCase() === key.toUpperCase())) {
    await supabase
      .from("recurring_patterns")
      .update({ label_pattern: [...existing, key].join("\n") })
      .eq("id", recurringId);
    addedLabel = key;
  }

  const res = await applyRecurringPattern(recurringId);
  if (!res.ok) return res;
  return { ok: true, applied: res.applied, addedLabel, ids: res.ids };
}

/**
 * Ajoute un motif de libellé à une récurrente (depuis l'aperçu d'import, sans
 * transaction encore importée) et applique la récurrente aux transactions
 * existantes. Le motif ajouté fera aussi matcher la ligne à l'import.
 */
export async function associateLabelToRecurring(
  recurringId: string,
  rawLabel: string,
): Promise<
  | { ok: true; applied: number; addedLabel: string | null; ids: string[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("recurring_patterns")
    .select("label_pattern")
    .eq("id", recurringId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Récurrente introuvable" };

  const key = recurringKey(rawLabel);
  const existing = labelPatterns(p.label_pattern);
  let addedLabel: string | null = null;
  if (key && !existing.some((l) => l.toUpperCase() === key.toUpperCase())) {
    await supabase
      .from("recurring_patterns")
      .update({ label_pattern: [...existing, key].join("\n") })
      .eq("id", recurringId);
    addedLabel = key;
  }
  const res = await applyRecurringPattern(recurringId);
  if (!res.ok) return res;
  return { ok: true, applied: res.applied, addedLabel, ids: res.ids };
}

/** Annule une association : retire le motif ajouté et détache les transactions. */
export async function undoAssociateRecurring(
  recurringId: string,
  addedLabel: string | null,
  ids: string[],
): Promise<ActionResult> {
  const supabase = await createClient();
  if (addedLabel) {
    const { data: p } = await supabase
      .from("recurring_patterns")
      .select("label_pattern")
      .eq("id", recurringId)
      .maybeSingle();
    if (p) {
      const kept = labelPatterns(p.label_pattern).filter(
        (l) => l.toUpperCase() !== addedLabel.toUpperCase(),
      );
      await supabase
        .from("recurring_patterns")
        .update({ label_pattern: kept.length ? kept.join("\n") : null })
        .eq("id", recurringId);
    }
  }
  if (ids.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      await supabase
        .from("transactions")
        .update({ recurring_pattern_id: null, is_recurring: false })
        .in("id", ids.slice(i, i + CHUNK));
    }
  }
  revalidate();
  revalidatePath("/transactions");
  return { ok: true };
}

/** Détache une transaction d'une récurrente. */
export async function detachTransactionFromRecurring(
  transactionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ recurring_pattern_id: null, is_recurring: false })
    .eq("id", transactionId);
  if (error) return fail(error.message);
  revalidate();
  revalidatePath("/transactions");
  return { ok: true };
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
