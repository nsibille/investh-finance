"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  listInstitutions,
  createRequisition,
  getAccountTransactions,
  isGoCardlessConfigured,
} from "@/lib/gocardless/client";
import { mapGoCardlessTransactions } from "@/lib/gocardless/mapper";
import { importParsedTransactions } from "@/lib/import/importer";
import type { GCInstitution } from "@/lib/gocardless/types";
import type { ImportSummary } from "@/lib/import/types";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function listFrenchInstitutions(): Promise<
  Result<{ institutions: GCInstitution[] }>
> {
  if (!isGoCardlessConfigured()) {
    return { ok: false, error: "GoCardless non configuré (clés manquantes)." };
  }
  try {
    const institutions = await listInstitutions("fr");
    return { ok: true, institutions };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur GoCardless" };
  }
}

export async function startBankConnection(
  institutionId: string,
  institutionName: string,
): Promise<Result<{ link: string }>> {
  if (!isGoCardlessConfigured()) {
    return { ok: false, error: "GoCardless non configuré (clés manquantes)." };
  }
  try {
    const origin = await getOrigin();
    const reference = randomUUID();
    const requisition = await createRequisition({
      institutionId,
      redirect: `${origin}/api/bank/callback`,
      reference,
    });

    const supabase = await createClient();
    const { error } = await supabase.from("bank_connections").insert({
      requisition_id: requisition.id,
      reference,
      institution_id: institutionId,
      institution_name: institutionName,
      status: "created",
    });
    if (error) return { ok: false, error: error.message };

    return { ok: true, link: requisition.link };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur GoCardless" };
  }
}

export async function linkBankAccount(
  connectionId: string,
  accountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_connections")
    .update({ account_id: accountId })
    .eq("id", connectionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/import");
  return { ok: true };
}

export async function syncBankConnection(
  connectionId: string,
): Promise<Result<{ summary: ImportSummary }>> {
  if (!isGoCardlessConfigured()) {
    return { ok: false, error: "GoCardless non configuré (clés manquantes)." };
  }
  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();

  if (!connection) return { ok: false, error: "Connexion introuvable" };
  if (!connection.gc_account_id) return { ok: false, error: "Compte bancaire non lié" };
  if (!connection.account_id) {
    return { ok: false, error: "Associe d'abord un compte Lyra à cette connexion." };
  }

  try {
    const dateFrom = connection.last_synced_at
      ? connection.last_synced_at.slice(0, 10)
      : undefined;
    const { transactions } = await getAccountTransactions(
      connection.gc_account_id,
      dateFrom,
    );
    const parsed = mapGoCardlessTransactions(transactions.booked ?? []);

    const summary = await importParsedTransactions(connection.account_id, parsed, {
      bankFormat: "gocardless",
      sourceFilename: `Sync ${connection.institution_name ?? "banque"} ${new Date()
        .toISOString()
        .slice(0, 10)}`,
    });

    await supabase
      .from("bank_connections")
      .update({ last_synced_at: new Date().toISOString(), status: "linked" })
      .eq("id", connectionId);

    revalidatePath("/import");
    revalidatePath("/transactions");
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur de synchronisation" };
  }
}

export async function deleteBankConnection(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("bank_connections").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/import");
  return { ok: true };
}
