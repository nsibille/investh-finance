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
import { contentKey, type ExistingEntry } from "@/lib/import/dedup";
import { getInternalTransferSubcategoryId } from "@/lib/import/transfers";
import { isDeferredDebit, getDeferredDebitSubcategoryId } from "@/lib/import/deferred";
import { matchInternalTransfers } from "@/lib/transactions/transferMatch";
import { applyRules, type EngineRule } from "@/lib/rules/engine";
import { loadEngineRules } from "@/lib/rules/loader";
import { matchesPattern } from "@/lib/recurring/checker";
import { merchantCompatible, recurringAcceptableMerchants } from "@/lib/import/merchantGate";
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

/** Premier jour du mois d'une date ISO (YYYY-MM-DD). */
function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Dernier jour du mois d'une date ISO (YYYY-MM-DD), sans dérive de fuseau. */
function monthEnd(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * Opérations déjà en base (clé contenu → { libellé, date, montant }), pour les
 * comptes ciblés et la fenêtre de dates du lot. Sert à détecter les doublons
 * « inter-source » (même compte + date + montant, libellé/hash différents) que
 * le rapprochement par hash exact ne voit pas : le libellé départage les vrais
 * doublons des simples collisions date+montant (cf. `labelsSimilar`).
 *
 * Pour un compte carte à débit différé (`deferredAccountIds`), la clé est
 * construite au MOIS et la fenêtre de dates est élargie aux bornes du mois, afin
 * de rattraper une opération dont la date provisoire (fin de mois) diffère de la
 * date réelle au sein du même mois.
 */
async function fetchExistingContent(
  supabase: Supa,
  transactions: ParsedTransaction[],
  accountIds: string[],
  deferredAccountIds: Set<string> = new Set(),
): Promise<Map<string, ExistingEntry[]>> {
  const byKey = new Map<string, ExistingEntry[]>();
  if (accountIds.length === 0 || transactions.length === 0) return byKey;
  const dates = transactions.map((t) => t.operation_date);
  const minDate = dates.reduce((m, d) => (d < m ? d : m), dates[0]);
  const maxDate = dates.reduce((m, d) => (d > m ? d : m), dates[0]);
  // Fenêtre élargie aux bornes du mois si un compte carte différée est ciblé
  // (une opération peut y figurer à une date du même mois hors [min, max]).
  const anyDeferred = accountIds.some((id) => deferredAccountIds.has(id));
  const from = anyDeferred ? monthStart(minDate) : minDate;
  const to = anyDeferred ? monthEnd(maxDate) : maxDate;
  const { data } = await supabase
    .from("transactions")
    .select("id, account_id, operation_date, amount, raw_label")
    .in("account_id", accountIds)
    .gte("operation_date", from)
    .lte("operation_date", to);
  for (const r of data ?? []) {
    const monthly = deferredAccountIds.has(r.account_id);
    const k = contentKey(r.account_id, r.operation_date, Number(r.amount), monthly);
    const entry: ExistingEntry = {
      id: r.id,
      label: r.raw_label,
      operation_date: r.operation_date,
      amount: Number(r.amount),
    };
    const slot = byKey.get(k);
    if (slot) slot.push(entry);
    else byKey.set(k, [entry]);
  }
  return byKey;
}

async function loadRules(supabase: Supa): Promise<EngineRule[]> {
  const { rules } = await loadEngineRules(supabase);
  return rules;
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
  purchaseOccurrence?: number | null;
  purchaseInstallmentTotal?: number | null;
  purchaseEndless?: boolean;
  merchantId?: string | null;
  merchantName?: string | null;
  merchantLocked?: boolean;
};

/** Noms d'enseignes (id → nom) pour annoter l'aperçu. Nom nullable (enseigne sans nom). */
async function loadMerchantNames(supabase: Supa): Promise<Map<string, string | null>> {
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

/**
 * Modèle récurrent correspondant à une transaction (libellé + montant), à
 * condition que son enseigne ne contredise pas l'enseigne déjà résolue de la
 * transaction (`txMerchantId`, issue des règles — elle fait autorité).
 */
function matchRecurring(
  patterns: RecurringPattern[],
  accountId: string,
  tx: { raw_label: string; amount: number; operation_date: string },
  txMerchantId: string | null,
): RecurringPattern | null {
  return (
    patterns.find(
      (pat) =>
        matchesPattern(pat, {
          account_id: accountId,
          raw_label: tx.raw_label,
          amount: tx.amount,
          operation_date: tx.operation_date,
        }) &&
        merchantCompatible(txMerchantId, recurringAcceptableMerchants(pat.merchant_id)),
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
      // Enseigne déjà résolue (règles/récurrence) : gate d'appariement de l'achat.
      merchantId: r.merchantId ?? null,
      dup: r.duplicateReason === "existing",
    }))
    .filter((r) => !r.dup)
    .map(({ index, operation_date, amount, raw_label, merchantId }) => ({
      index,
      operation_date,
      amount,
      raw_label,
      merchantId,
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
      purchaseOccurrence: m.occurrence,
      purchaseInstallmentTotal: m.installmentTotal,
      purchaseEndless: m.endless,
      // Catégorie héritée de l'achat (surchargeable dans l'aperçu).
      initialSubcategoryId: m.subcategoryId ?? r.initialSubcategoryId,
      // L'enseigne de la transaction fait autorité : l'enseigne de l'achat ne
      // sert qu'à REMPLIR une ligne sans enseigne (jamais à écraser).
      ...(m.merchantId && !r.merchantId
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

    const [{ data: accounts }, rules, transferSubId, deferredSubId, merchantNames, patterns] =
      await Promise.all([
        supabase.from("accounts").select("id, connection_name, is_deferred_card"),
        loadRules(supabase),
        getInternalTransferSubcategoryId(supabase),
        getDeferredDebitSubcategoryId(supabase),
        loadMerchantNames(supabase),
        loadRecurringPatterns(supabase),
      ]);
    const accountIdByConnection = new Map<string, string>();
    const deferredAccountIds = new Set<string>();
    for (const a of accounts ?? []) {
      if (a.connection_name) {
        accountIdByConnection.set(normalizeConnection(a.connection_name), a.id);
      }
      if (a.is_deferred_card) deferredAccountIds.add(a.id);
    }

    const targets = resolveCsvTargets(transactions, accountIdByConnection);
    const knownHashes = targets
      .map((t) => t.hash)
      .filter((h): h is string => h !== null);
    const targetAccountIds = [
      ...new Set(
        targets
          .map((t) => t.accountId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const [existingSet, existingContent] = await Promise.all([
      fetchExistingHashes(supabase, knownHashes),
      fetchExistingContent(supabase, transactions, targetAccountIds, deferredAccountIds),
    ]);
    const { rows, connections } = buildCsvPreview(
      transactions,
      targets,
      existingSet,
      existingContent,
      deferredAccountIds,
    );

    // Virements internes : appariés par connexion (2 comptes différents).
    const transferIdx = transferSubId
      ? detectTransferIndices(transactions, (t) => normalizeConnection(t.connection_name))
      : new Set<number>();

    // Catégorie proposée par les règles ; les virements priment (catégorie
    // « Virement interne ») et sont envoyés en override à l'import.
    const withSuggestion = rows.map((r, i) => {
      const accId = targets[i].accountId ?? "";
      const { subcategory_id, merchant_id } = suggestFromRules(rules, accId, r);
      const pattern = matchRecurring(patterns, accId, r, merchant_id);
      const initialSubcategoryId =
        transferIdx.has(i) && transferSubId
          ? transferSubId
          : deferredSubId && isDeferredDebit(r.raw_label)
            ? deferredSubId
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
  const { data: account } = await supabase
    .from("accounts")
    .select("is_deferred_card")
    .eq("id", accountId)
    .maybeSingle();
  const isDeferredCard = Boolean(account?.is_deferred_card);
  const deferredAccountIds = isDeferredCard ? new Set([accountId]) : new Set<string>();
  const [existingSet, existingContent, rules, deferredSubId, merchantNames, patterns] =
    await Promise.all([
      fetchExistingHashes(supabase, hashes),
      fetchExistingContent(supabase, transactions, [accountId], deferredAccountIds),
      loadRules(supabase),
      getDeferredDebitSubcategoryId(supabase),
      loadMerchantNames(supabase),
      loadRecurringPatterns(supabase),
    ]);
  const { rows } = buildPreviewRows(
    accountId,
    transactions,
    existingSet,
    existingContent,
    isDeferredCard,
  );
  const withSuggestion = rows.map((r) => {
    const { subcategory_id, merchant_id } = suggestFromRules(rules, accountId, r);
    const pattern = matchRecurring(patterns, accountId, r, merchant_id);
    const effMerchant = merchant_id ?? pattern?.merchant_id ?? null;
    // Relevé PDF = un seul compte : pas de virement interne détectable ici.
    return {
      ...r,
      suggestedSubcategoryId: subcategory_id,
      initialSubcategoryId:
        deferredSubId && isDeferredDebit(r.raw_label)
          ? deferredSubId
          : (subcategory_id ?? pattern?.subcategory_id ?? null),
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
