"use client";

import { useMemo, useState } from "react";
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
import { confirmImport, confirmCsvImport } from "@/server/actions/import";
import type { ParsedTransaction } from "@/lib/import/types";
import type { DuplicateReason, ConnectionSummary } from "@/lib/import/preview";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";

interface PreviewRow extends ParsedTransaction {
  duplicate: boolean;
  duplicateReason: DuplicateReason;
  connectionLabel?: string;
  targetAccountExists?: boolean;
  suggestedSubcategoryId?: string | null;
  /** Catégorie courante (proposée par les règles, éventuellement modifiée). */
  categoryId: string | null;
  include: boolean;
}

interface Preview {
  bank: string;
  bankLabel: string;
  sourceFormat: string;
  warning: string | null;
  multiAccount: boolean;
  connections: ConnectionSummary[];
  rows: PreviewRow[];
  filename: string;
  dupExisting: number;
  dupInFile: number;
}

export function StatementImport({
  accountOptions,
  subcategoryOptions,
}: {
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [accountId, setAccountId] = useState(accountOptions[0]?.id ?? "");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const optLabel = useMemo(
    () => new Map(subcategoryOptions.map((o) => [o.id, o.label])),
    [subcategoryOptions],
  );

  async function handleFile(file: File) {
    setError(null);
    setParsing(true);
    setPreview(null);
    setEditing(null);
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
        multiAccount: data.multiAccount ?? false,
        connections: data.connections ?? [],
        filename: file.name,
        dupExisting: data.dupExisting ?? 0,
        dupInFile: data.dupInFile ?? 0,
        rows: data.rows.map((r: PreviewRow) => ({
          ...r,
          categoryId: r.suggestedSubcategoryId ?? null,
          include: !r.duplicate,
        })),
      });
    } catch {
      setError("Échec de l'analyse du fichier.");
    } finally {
      setParsing(false);
    }
  }

  function patchRow(index: number, patch: Partial<PreviewRow>) {
    setPreview((prev) =>
      prev
        ? { ...prev, rows: prev.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) }
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
    const payload: ParsedTransaction[] = included.map((r) => {
      const base: ParsedTransaction = {
        operation_date: r.operation_date,
        value_date: r.value_date,
        label: r.label,
        raw_label: r.raw_label,
        amount: r.amount,
        currency: r.currency,
        external_id: r.external_id,
        connection_name: r.connection_name,
      };
      // N'envoie la catégorie que si l'utilisateur l'a modifiée : sinon les
      // règles s'appliquent à l'import (et leur compteur de hits est suivi).
      const suggested = r.suggestedSubcategoryId ?? null;
      if (r.categoryId !== suggested) base.subcategory_id = r.categoryId;
      return base;
    });

    const res = preview.multiAccount
      ? await confirmCsvImport(payload, preview.filename)
      : await confirmImport(accountId, payload, preview.sourceFormat, preview.filename);

    setImporting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const parts = [`${res.summary.rows_imported} importée(s)`];
    if ("accounts_created" in res.summary && res.summary.accounts_created > 0) {
      parts.push(`${res.summary.accounts_created} compte(s) créé(s)`);
    }
    if (res.transfersDetected > 0) {
      parts.push(`${res.transfersDetected} virement(s) interne(s)`);
    }
    parts.push(`${res.summary.rows_duplicates} doublon(s)`);
    toast.success(parts.join(" · "));
    setPreview(null);
    router.refresh();
  }

  const includedCount = preview?.rows.filter((r) => r.include).length ?? 0;
  const dupTotal = preview ? preview.dupExisting + preview.dupInFile : 0;

  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {accountOptions.length > 0 && (
          <div style={{ maxWidth: 360 }}>
            <FormField label="Compte de destination (relevé PDF)">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
              Les exports CSV rattachent/créent les comptes automatiquement (colonne « Nom de la connexion »).
            </p>
          </div>
        )}

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

            {preview.multiAccount && preview.connections.length > 0 && (
              <Alert variant="info">
                <span>
                  Comptes détectés :{" "}
                  {preview.connections
                    .map((c) => `${c.label} (${c.exists ? "existant" : "sera créé"}, ${c.count} op.)`)
                    .join(" · ")}
                </span>
              </Alert>
            )}

            {preview.warning && <Alert variant="warning">{preview.warning}</Alert>}

            {dupTotal > 0 && (
              <Alert variant="warning">
                {dupTotal} doublon{dupTotal > 1 ? "s" : ""} sur la clé date · libellé · montant
                {preview.dupExisting > 0 && ` — ${preview.dupExisting} déjà en base (ignoré${preview.dupExisting > 1 ? "s" : ""})`}
                {preview.dupInFile > 0 && ` — ${preview.dupInFile} répété${preview.dupInFile > 1 ? "s" : ""} dans le fichier`}
                . Décochés par défaut ; recoche un doublon « fichier » si c&apos;est bien une opération distincte.
              </Alert>
            )}

            <div style={{ overflowX: "auto" }}>
              <table className="table-import-preview">
                <thead>
                  <tr>
                    <th>Date</th>
                    {preview.multiAccount && <th>Compte</th>}
                    <th>Libellé</th>
                    <th>Catégorie</th>
                    <th style={{ textAlign: "right" }}>Montant</th>
                    <th>Statut</th>
                    <th>Inclure</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr
                      key={i}
                      data-excluded={!r.include || undefined}
                      data-duplicate={
                        r.duplicateReason === "in_file"
                          ? "file"
                          : r.duplicateReason === "existing"
                            ? "existing"
                            : undefined
                      }
                    >
                      <td style={{ whiteSpace: "nowrap" }}>{formatShortDate(r.operation_date)}</td>
                      {preview.multiAccount && (
                        <td style={{ whiteSpace: "nowrap", color: "var(--color-text-muted)" }}>
                          {r.connectionLabel}
                        </td>
                      )}
                      <td>{r.label}</td>
                      <td style={{ minWidth: 180 }}>
                        {editing === i ? (
                          <Select
                            autoFocus
                            value={r.categoryId ?? ""}
                            onChange={(e) => {
                              patchRow(i, { categoryId: e.target.value || null });
                              setEditing(null);
                            }}
                            onBlur={() => setEditing(null)}
                          >
                            <option value="">Non catégorisée</option>
                            {subcategoryOptions.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <button
                            type="button"
                            className="import-cat-edit"
                            onClick={() => setEditing(i)}
                            data-empty={r.categoryId ? undefined : "true"}
                          >
                            {r.categoryId ? (optLabel.get(r.categoryId) ?? "—") : "Non catégorisée"}
                          </button>
                        )}
                      </td>
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
                          disabled={r.duplicateReason === "existing"}
                          onChange={() => patchRow(i, { include: !r.include })}
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
