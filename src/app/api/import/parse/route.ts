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
import { getInternalTransferSubcategoryId } from "@/lib/import/transfers";
import { matchInternalTransfers } from "@/lib/transactions/transferMatch";
import { applyRules, toEngineRule, type EngineRule } from "@/lib/rules/engine";
import { matchesPattern } from "@/lib/recurring/checker";
import {
  matchPreviewRowsToPurchases,
  type PreviewRow,
} from "@/lib/purchases/match";
import type { ParsedTransaction } from "@/lib/import/types";
import type { Database } from "@/types/database.types";

type RecurringPattern =
  Database["public"]["Tables"]["recurring_patterns"]["Row"];

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

/** Proposition des règles (catégorie + enseigne) pour une transaction. */
function suggestFromRules(
  rules: EngineRule[],
  accountId: string,
  tx: ParsedTransaction,
): { subcategory_id: string | null; merchant_id: string | null } {
  const o = applyRules(
    { account_id: accountId, amount: tx.amount, raw_label: tx.raw_label },
    rules,
  );
  return { subcategory_id: o.subcategory_id, merchant_id: o.merchant_id };
}

/**
 * Détecte les virements internes dans le lot analysé (montants opposés, 2
 * comptes différents, ±4 jours) et renvoie l'ensemble des indices concernés.
 * Le compte est identifié par `accountKeyOf` (connexion pour un CSV).
 */
function detectTransferIndices(
  transactions: ParsedTransaction[],
  accountKeyOf: (tx: ParsedTransaction, i: number) => string,
): Set<number> {
  const candidates = transactions.map((t, i) => ({
    id: String(i),
    account_id: accountKeyOf(t, i),
    amount: t.amount,
    operation_date: t.operation_date,
  }));
  const idx = new Set<number>();
  for (const [a, b] of matchInternalTransfers(candidates, 4)) {
    idx.add(Number(a));
    idx.add(Number(b));
  }
  return idx;
}

type PreviewRowLike = {
  operation_date: string;
  amount: number;
  raw_label: string;
  duplicateReason?: string | null;
  initialSubcategoryId?: string | null;
  purchaseId?: string;
  purchaseName?: string;
  merchantId?: string | null;
  merchantName?: string | null;
  merchantLocked?: boolean;
};

/** Noms d'enseignes (id → nom) pour annoter l'aperçu. */
async function loadMerchantNames(supabase: Supa): Promise<Map<string, string>> {
  const { data } = await supabase.from("merchants").select("id, name");
  return new Map((data ?? []).map((m) => [m.id, m.name]));
}

/** Modèles récurrents actifs, pour détecter les récurrences dans l'aperçu. */
async function loadRecurringPatterns(supabase: Supa): Promise<RecurringPattern[]> {
  const { data } = await supabase
    .from("recurring_patterns")
    .select("*")
    .eq("is_active", true);
  return data ?? [];
}

/** Modèle récurrent correspondant à une transaction (libellé + montant). */
function matchRecurring(
  patterns: RecurringPattern[],
  accountId: string,
  tx: { raw_label: string; amount: number; operation_date: string },
): RecurringPattern | null {
  return (
    patterns.find((pat) =>
      matchesPattern(pat, {
        account_id: accountId,
        raw_label: tx.raw_label,
        amount: tx.amount,
        operation_date: tx.operation_date,
      }),
    ) ?? null
  );
}

/**
 * Pré-rattache les lignes (hors doublons existants) aux mensualités
 * prévisionnelles d'achats : l'aperçu affiche le rattachement avant l'import.
 */
async function annotatePurchaseMatches<T extends PreviewRowLike>(
  supabase: Supa,
  rows: T[],
): Promise<T[]> {
  const candidates: PreviewRow[] = rows
    .map((r, index) => ({
      index,
      operation_date: r.operation_date,
      amount: r.amount,
      raw_label: r.raw_label,
      dup: r.duplicateReason === "existing",
    }))
    .filter((r) => !r.dup)
    .map(({ index, operation_date, amount, raw_label }) => ({
      index,
      operation_date,
      amount,
      raw_label,
    }));
  const matches = await matchPreviewRowsToPurchases(supabase, candidates);
  if (matches.size === 0) return rows;
  return rows.map((r, i) => {
    const m = matches.get(i);
    if (!m) return r;
    return {
      ...r,
      purchaseId: m.purchaseId,
      purchaseName: m.purchaseName,
      // Catégorie héritée de l'achat (surchargeable dans l'aperçu).
      initialSubcategoryId: m.subcategoryId ?? r.initialSubcategoryId,
      // L'enseigne de l'achat prime et n'est pas éditable pour cette ligne.
      ...(m.merchantId
        ? {
            merchantId: m.merchantId,
            merchantName: m.merchantName,
            merchantLocked: true,
          }
        : {}),
    };
  });
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

    const [{ data: accounts }, rules, transferSubId, merchantNames, patterns] =
      await Promise.all([
        supabase.from("accounts").select("id, connection_name"),
        loadRules(supabase),
        getInternalTransferSubcategoryId(supabase),
        loadMerchantNames(supabase),
        loadRecurringPatterns(supabase),
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

    // Virements internes : appariés par connexion (2 comptes différents).
    const transferIdx = transferSubId
      ? detectTransferIndices(transactions, (t) => normalizeConnection(t.connection_name))
      : new Set<number>();

    // Catégorie proposée par les règles ; les virements priment (catégorie
    // « Virement interne ») et sont envoyés en override à l'import.
    const withSuggestion = rows.map((r, i) => {
      const accId = targets[i].accountId ?? "";
      const { subcategory_id, merchant_id } = suggestFromRules(rules, accId, r);
      const pattern = matchRecurring(patterns, accId, r);
      const initialSubcategoryId =
        transferIdx.has(i) && transferSubId
          ? transferSubId
          : (subcategory_id ?? pattern?.subcategory_id ?? null);
      // Enseigne : règle en priorité, sinon celle du modèle récurrent.
      const effMerchant = merchant_id ?? pattern?.merchant_id ?? null;
      return {
        ...r,
        suggestedSubcategoryId: subcategory_id,
        initialSubcategoryId,
        ...(effMerchant
          ? { merchantId: effMerchant, merchantName: merchantNames.get(effMerchant) ?? null }
          : {}),
        ...(pattern ? { recurringName: pattern.name } : {}),
      };
    });

    const dupExisting = rows.filter((r) => r.duplicateReason === "existing").length;
    const previewRows = await annotatePurchaseMatches(supabase, withSuggestion);

    return NextResponse.json({
      ok: true,
      bank: "bankin",
      bankLabel: "Export CSV (Bankin')",
      sourceFormat: "csv:bankin",
      warning: null,
      multiAccount: true,
      connections,
      rows: previewRows,
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
  const [existingSet, rules, merchantNames, patterns] = await Promise.all([
    fetchExistingHashes(supabase, hashes),
    loadRules(supabase),
    loadMerchantNames(supabase),
    loadRecurringPatterns(supabase),
  ]);
  const { rows } = buildPreviewRows(accountId, transactions, existingSet);
  const withSuggestion = rows.map((r) => {
    const { subcategory_id, merchant_id } = suggestFromRules(rules, accountId, r);
    const pattern = matchRecurring(patterns, accountId, r);
    const effMerchant = merchant_id ?? pattern?.merchant_id ?? null;
    // Relevé PDF = un seul compte : pas de virement interne détectable ici.
    return {
      ...r,
      suggestedSubcategoryId: subcategory_id,
      initialSubcategoryId: subcategory_id ?? pattern?.subcategory_id ?? null,
      ...(effMerchant
        ? { merchantId: effMerchant, merchantName: merchantNames.get(effMerchant) ?? null }
        : {}),
      ...(pattern ? { recurringName: pattern.name } : {}),
    };
  });
  const dupExisting = rows.filter((r) => r.duplicateReason === "existing").length;
  const previewRows = await annotatePurchaseMatches(supabase, withSuggestion);

  return NextResponse.json({
    ok: true,
    bank: parsed.bank,
    bankLabel: BANK_LABELS[parsed.bank],
    sourceFormat: `pdf:${parsed.bank}`,
    warning,
    multiAccount: false,
    connections: [],
    rows: previewRows,
    total: rows.length,
    newCount: rows.filter((r) => !r.duplicate).length,
    dupCount: dupExisting,
    dupExisting,
  });
}
