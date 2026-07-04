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
import { useImportStore, type ImportPreviewRow } from "@/stores/import";
import type { ParsedTransaction } from "@/lib/import/types";
import type { AccountOption } from "@/lib/rules/queries";
import type { SubcategoryOption } from "@/lib/categories/types";

export function StatementImport({
  accountOptions,
  subcategoryOptions,
}: {
  accountOptions: AccountOption[];
  subcategoryOptions: SubcategoryOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  // Aperçu conservé dans un store : survit à la navigation (retour sur /import).
  const preview = useImportStore((s) => s.preview);
  const setPreview = useImportStore((s) => s.setPreview);
  const patchRow = useImportStore((s) => s.patchRow);
  const [accountId, setAccountId] = useState(accountOptions[0]?.id ?? "");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        rows: data.rows.map((r: ImportPreviewRow) => ({
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

            {preview.dupExisting > 0 && (
              <Alert variant="warning">
                {preview.dupExisting} transaction{preview.dupExisting > 1 ? "s" : ""} déjà
                présente{preview.dupExisting > 1 ? "s" : ""} en base (clé date · libellé · montant)
                — décochée{preview.dupExisting > 1 ? "s" : ""}, elles ne seront pas ré-importées.
              </Alert>
            )}

            <table className="table-import-preview">
              <thead>
                <tr>
                  <th style={{ width: 92 }}>Date</th>
                  {preview.multiAccount && <th style={{ width: 110 }}>Compte</th>}
                  <th>Libellé</th>
                  <th style={{ width: 200 }}>Catégorie</th>
                  <th style={{ width: 100, textAlign: "right" }}>Montant</th>
                  <th style={{ width: 90 }}>Statut</th>
                  <th style={{ width: 64 }}>Inclure</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                    <tr
                      key={i}
                      data-excluded={!r.include || undefined}
                      data-duplicate={r.duplicateReason === "existing" ? "existing" : undefined}
                    >
                      <td style={{ whiteSpace: "nowrap" }}>{formatShortDate(r.operation_date)}</td>
                      {preview.multiAccount && (
                        <td style={{ color: "var(--color-text-muted)" }} title={r.connectionLabel}>
                          {r.connectionLabel}
                        </td>
                      )}
                      <td title={r.label}>{r.label}</td>
                      <td>
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
                        <ImportRowBadge kind={r.duplicateReason === "existing" ? "duplicate" : "new"} />
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
          </>
        )}
      </div>
    </Card>
  );
}
