import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf/extract";
import { parseStatementText, BANK_LABELS } from "@/lib/import/parsers";
import { computeDedupHash } from "@/lib/import/dedup";

export async function POST(request: Request) {
  const form = await request.formData();
  const accountId = form.get("accountId");
  const file = form.get("file");

  if (typeof accountId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
  }

  let text: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
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

  // Flag duplicates already present for this account.
  const supabase = await createClient();
  const hashes = parsed.transactions.map((t) => computeDedupHash(accountId, t));
  const { data: existing } = await supabase
    .from("transactions")
    .select("dedup_hash")
    .eq("account_id", accountId)
    .in("dedup_hash", hashes);
  const existingSet = new Set((existing ?? []).map((r) => r.dedup_hash));

  const rows = parsed.transactions.map((t, i) => ({
    ...t,
    duplicate: existingSet.has(hashes[i]),
  }));

  return NextResponse.json({
    ok: true,
    bank: parsed.bank,
    bankLabel: BANK_LABELS[parsed.bank],
    rows,
    total: rows.length,
    newCount: rows.filter((r) => !r.duplicate).length,
    dupCount: rows.filter((r) => r.duplicate).length,
  });
}
