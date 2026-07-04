import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract";
import { parseStatementText, BANK_LABELS } from "@/lib/import/parsers";
import { parseBankinCsv } from "@/lib/import/parsers/bankinCsv";
import { decodeTextFile } from "@/lib/import/decode";
import { buildPreviewRows } from "@/lib/import/preview";
import { computeDedupHash } from "@/lib/import/dedup";
import type { ParsedTransaction } from "@/lib/import/types";

function isCsv(file: File): boolean {
  const name = file.name.toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(name)) return true;
  return /csv|tab-separated|text\/plain/.test(file.type);
}

/** Analyse un fichier (PDF ou CSV) et renvoie un aperçu avec doublons flaggés. */
export async function POST(request: Request) {
  const form = await request.formData();
  const accountId = form.get("accountId");
  const file = form.get("file");

  if (typeof accountId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
  }

  let transactions: ParsedTransaction[];
  let bank: string;
  let bankLabel: string;
  let sourceFormat: string;
  let warning: string | null = null;

  const bytes = new Uint8Array(await file.arrayBuffer());

  if (isCsv(file)) {
    const text = decodeTextFile(bytes);
    const { transactions: csvTx, unrecognized } = parseBankinCsv(text);
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
    if (csvTx.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Aucune transaction détectée dans ce fichier." },
        { status: 422 },
      );
    }
    transactions = csvTx;
    bank = "bankin";
    bankLabel = "Export CSV (Bankin')";
    sourceFormat = "csv:bankin";
  } else {
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
    transactions = parsed.transactions;
    bank = parsed.bank;
    bankLabel = BANK_LABELS[parsed.bank];
    sourceFormat = `pdf:${parsed.bank}`;
    if (parsed.bank === "societegenerale") {
      warning =
        "Le sens débit/crédit de la Société Générale est déduit du libellé. Vérifie les montants avant d'importer.";
    }
  }

  // Flag les doublons : déjà en base (pour ce compte) et répétés dans le fichier.
  // On interroge par lots pour éviter de dépasser la limite d'URL de PostgREST
  // (un export CSV peut compter des milliers de lignes).
  const supabase = await createClient();
  const hashes = transactions.map((t) => computeDedupHash(accountId, t));
  const existingSet = new Set<string>();
  const CHUNK = 300;
  for (let i = 0; i < hashes.length; i += CHUNK) {
    const slice = hashes.slice(i, i + CHUNK);
    const { data } = await supabase
      .from("transactions")
      .select("dedup_hash")
      .eq("account_id", accountId)
      .in("dedup_hash", slice);
    for (const r of data ?? []) existingSet.add(r.dedup_hash);
  }

  const { rows } = buildPreviewRows(accountId, transactions, existingSet);
  const dupExisting = rows.filter((r) => r.duplicateReason === "existing").length;
  const dupInFile = rows.filter((r) => r.duplicateReason === "in_file").length;

  return NextResponse.json({
    ok: true,
    bank,
    bankLabel,
    sourceFormat,
    warning,
    rows,
    total: rows.length,
    newCount: rows.filter((r) => !r.duplicate).length,
    dupCount: dupExisting + dupInFile,
    dupExisting,
    dupInFile,
  });
}
