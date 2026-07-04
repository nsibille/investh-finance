import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract";
import { parseStatementText, BANK_LABELS } from "@/lib/import/parsers";
import { parseBankinCsv } from "@/lib/import/parsers/bankinCsv";
import { decodeTextFile } from "@/lib/import/decode";
import {
  buildPreviewRows,
  occurrenceHashes,
  resolveCsvTargets,
  buildCsvPreview,
} from "@/lib/import/preview";
import { normalizeConnection } from "@/lib/import/connection";
import { applyRules, toEngineRule, type EngineRule } from "@/lib/rules/engine";
import type { ParsedTransaction } from "@/lib/import/types";

function isCsv(file: File): boolean {
  const name = file.name.toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(name)) return true;
  return /csv|tab-separated|text\/plain/.test(file.type);
}

const CHUNK = 300;

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Récupère par lots les dedup_hash déjà présents (limite d'URL PostgREST). */
async function fetchExistingHashes(supabase: Supa, hashes: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const { data } = await supabase
      .from("transactions")
      .select("dedup_hash")
      .in("dedup_hash", hashes.slice(i, i + CHUNK));
    for (const r of data ?? []) set.add(r.dedup_hash);
  }
  return set;
}

async function loadRules(supabase: Supa): Promise<EngineRule[]> {
  const { data } = await supabase
    .from("categorization_rules")
    .select("*")
    .eq("is_active", true)
    .order("priority", { ascending: true });
  return (data ?? []).map(toEngineRule);
}

/** Sous-catégorie proposée par les règles pour une transaction d'un compte donné. */
function suggestSubcategory(
  rules: EngineRule[],
  accountId: string,
  tx: ParsedTransaction,
): string | null {
  return applyRules(
    { account_id: accountId, amount: tx.amount, raw_label: tx.raw_label },
    rules,
  ).subcategory_id;
}

/** Analyse un fichier (PDF ou CSV) et renvoie un aperçu avec doublons flaggés. */
export async function POST(request: Request) {
  const form = await request.formData();
  const accountIdRaw = form.get("accountId");
  const accountId = typeof accountIdRaw === "string" ? accountIdRaw : "";
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const supabase = await createClient();

  // ── CSV : rattachement automatique par « Nom de la connexion » ─────────────
  if (isCsv(file)) {
    const text = decodeTextFile(bytes);
    const { transactions, unrecognized } = parseBankinCsv(text);
    if (unrecognized) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Format CSV non reconnu (colonnes « Date », « Libellé » et « Montant » attendues).",
        },
        { status: 422 },
      );
    }
    if (transactions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Aucune transaction détectée dans ce fichier." },
        { status: 422 },
      );
    }

    const [{ data: accounts }, rules] = await Promise.all([
      supabase.from("accounts").select("id, connection_name"),
      loadRules(supabase),
    ]);
    const accountIdByConnection = new Map<string, string>();
    for (const a of accounts ?? []) {
      if (a.connection_name) {
        accountIdByConnection.set(normalizeConnection(a.connection_name), a.id);
      }
    }

    const targets = resolveCsvTargets(transactions, accountIdByConnection);
    const knownHashes = targets
      .map((t) => t.hash)
      .filter((h): h is string => h !== null);
    const existingSet = await fetchExistingHashes(supabase, knownHashes);
    const { rows, connections } = buildCsvPreview(transactions, targets, existingSet);

    // Catégorie proposée par les règles (compte existant, sinon règles globales).
    const withSuggestion = rows.map((r, i) => ({
      ...r,
      suggestedSubcategoryId: suggestSubcategory(rules, targets[i].accountId ?? "", r),
    }));

    const dupExisting = rows.filter((r) => r.duplicateReason === "existing").length;

    return NextResponse.json({
      ok: true,
      bank: "bankin",
      bankLabel: "Export CSV (Bankin')",
      sourceFormat: "csv:bankin",
      warning: null,
      multiAccount: true,
      connections,
      rows: withSuggestion,
      total: rows.length,
      newCount: rows.filter((r) => !r.duplicate).length,
      dupCount: dupExisting,
      dupExisting,
    });
  }

  // ── PDF : un compte de destination est requis ──────────────────────────────
  if (!accountId) {
    return NextResponse.json(
      { ok: false, error: "Choisis un compte de destination pour un relevé PDF." },
      { status: 400 },
    );
  }

  let text: string;
  try {
    text = await extractPdfText(bytes);
  } catch {
    return NextResponse.json({ ok: false, error: "Lecture du PDF impossible" }, { status: 422 });
  }

  const parsed = parseStatementText(text);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "Banque non reconnue (BforBank ou Société Générale attendus)." },
      { status: 422 },
    );
  }
  if (parsed.transactions.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Aucune transaction détectée dans ce relevé." },
      { status: 422 },
    );
  }

  const transactions: ParsedTransaction[] = parsed.transactions;
  const warning =
    parsed.bank === "societegenerale"
      ? "Le sens débit/crédit de la Société Générale est déduit du libellé. Vérifie les montants avant d'importer."
      : null;

  const hashes = occurrenceHashes(accountId, transactions);
  const [existingSet, rules] = await Promise.all([
    fetchExistingHashes(supabase, hashes),
    loadRules(supabase),
  ]);
  const { rows } = buildPreviewRows(accountId, transactions, existingSet);
  const withSuggestion = rows.map((r) => ({
    ...r,
    suggestedSubcategoryId: suggestSubcategory(rules, accountId, r),
  }));
  const dupExisting = rows.filter((r) => r.duplicateReason === "existing").length;

  return NextResponse.json({
    ok: true,
    bank: parsed.bank,
    bankLabel: BANK_LABELS[parsed.bank],
    sourceFormat: `pdf:${parsed.bank}`,
    warning,
    multiAccount: false,
    connections: [],
    rows: withSuggestion,
    total: rows.length,
    newCount: rows.filter((r) => !r.duplicate).length,
    dupCount: dupExisting,
    dupExisting,
  });
}
