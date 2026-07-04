"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Amount } from "@/components/ui/Amount";
import { ImportRowBadge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Checkbox";
import { useToast } from "@/hooks/useToast";
import { formatShortDate } from "@/lib/format/date";
import { confirmImport } from "@/server/actions/import";
import type { ParsedTransaction } from "@/lib/import/types";
import type { DuplicateReason } from "@/lib/import/preview";
import type { AccountOption } from "@/lib/rules/queries";

interface PreviewRow extends ParsedTransaction {
  duplicate: boolean;
  duplicateReason: DuplicateReason;
  include: boolean;
}

interface Preview {
  bank: string;
  bankLabel: string;
  sourceFormat: string;
  warning: string | null;
  rows: PreviewRow[];
  filename: string;
  dupExisting: number;
  dupInFile: number;
}

export function StatementImport({ accountOptions }: { accountOptions: AccountOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [accountId, setAccountId] = useState(accountOptions[0]?.id ?? "");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  async function handleFile(file: File) {
    if (!accountId) {
      setError("Choisis d'abord un compte de destination.");
      return;
    }
    setError(null);
    setParsing(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.append("accountId", accountId);
      fd.append("file", file);
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Échec de l'analyse");
        return;
      }
      setPreview({
        bank: data.bank,
        bankLabel: data.bankLabel,
        sourceFormat: data.sourceFormat,
        warning: data.warning ?? null,
        filename: file.name,
        dupExisting: data.dupExisting ?? 0,
        dupInFile: data.dupInFile ?? 0,
        rows: data.rows.map((r: PreviewRow) => ({ ...r, include: !r.duplicate })),
      });
    } catch {
      setError("Échec de l'analyse du fichier.");
    } finally {
      setParsing(false);
    }
  }

  function toggleRow(index: number) {
    setPreview((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r, i) =>
              i === index ? { ...r, include: !r.include } : r,
            ),
          }
        : prev,
    );
  }

  async function handleImport() {
    if (!preview) return;
    const included = preview.rows.filter((r) => r.include);
    if (included.length === 0) {
      toast.error("Aucune transaction sélectionnée.");
      return;
    }
    setImporting(true);
    const payload: ParsedTransaction[] = included.map((r) => ({
      operation_date: r.operation_date,
      value_date: r.value_date,
      label: r.label,
      raw_label: r.raw_label,
      amount: r.amount,
      currency: r.currency,
      external_id: r.external_id,
    }));
    const res = await confirmImport(
      accountId,
      payload,
      preview.sourceFormat,
      preview.filename,
    );
    setImporting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `${res.summary.rows_imported} importée(s), ${res.summary.rows_duplicates} doublon(s), ${res.summary.rows_auto_validated} auto-validée(s)`,
    );
    setPreview(null);
    router.refresh();
  }

  const includedCount = preview?.rows.filter((r) => r.include).length ?? 0;
  const dupTotal = preview ? preview.dupExisting + preview.dupInFile : 0;

  if (accountOptions.length === 0) {
    return (
      <Alert variant="info">
        Crée d&apos;abord un compte pour pouvoir y importer un relevé.
      </Alert>
    );
  }

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ maxWidth: 320 }}>
          <FormField label="Compte de destination">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {!preview && !parsing && (
          <FileDropzone
            onFile={handleFile}
            accept="application/pdf,.pdf,.csv,.tsv,.txt,text/csv"
            hint="Relevé PDF (BforBank, Société Générale) ou export CSV Bankin' (10 Mo max)"
          />
        )}

        {parsing && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-6)", justifyContent: "center" }}>
            <Spinner size="lg" />
            <span style={{ color: "var(--color-text-muted)" }}>Analyse du fichier…</span>
          </div>
        )}

        {preview && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                <FileText size={16} />
                <strong>{preview.bankLabel}</strong>
                <span style={{ color: "var(--color-text-muted)" }}>
                  · {preview.rows.length} opérations détectées
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Annuler
                </Button>
                <Button loading={importing} onClick={handleImport}>
                  Importer {includedCount} transaction{includedCount > 1 ? "s" : ""}
                </Button>
              </div>
            </div>

            {preview.warning && <Alert variant="warning">{preview.warning}</Alert>}

            {dupTotal > 0 && (
              <Alert variant="warning">
                {dupTotal} doublon{dupTotal > 1 ? "s" : ""} détecté
                {dupTotal > 1 ? "s" : ""} sur la clé date · libellé · montant
                {preview.dupExisting > 0 && ` — ${preview.dupExisting} déjà en base`}
                {preview.dupInFile > 0 && ` — ${preview.dupInFile} répété${preview.dupInFile > 1 ? "s" : ""} dans le fichier`}
                . Décoché{dupTotal > 1 ? "s" : ""} par défaut ; ces lignes ne
                seront pas ré-importées même si tu les coches.
              </Alert>
            )}

            <div style={{ overflowX: "auto" }}>
              <table className="table-import-preview">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Libellé</th>
                    <th style={{ textAlign: "right" }}>Montant</th>
                    <th>Statut</th>
                    <th>Inclure</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} data-excluded={!r.include || undefined}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatShortDate(r.operation_date)}</td>
                      <td>{r.label}</td>
                      <td style={{ textAlign: "right" }}>
                        <Amount value={r.amount} />
                      </td>
                      <td>
                        <ImportRowBadge
                          kind={
                            r.duplicateReason === "existing"
                              ? "duplicate"
                              : r.duplicateReason === "in_file"
                                ? "duplicate-file"
                                : "new"
                          }
                        />
                      </td>
                      <td>
                        <Toggle
                          checked={r.include}
                          onChange={() => toggleRow(i)}
                          aria-label="Inclure"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
