"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Alert } from "@/components/ui/Alert";
import { Toggle } from "@/components/ui/Checkbox";
import { useToast } from "@/hooks/useToast";
import { decodeTextFile } from "@/lib/import/decode";
import { parseRulesText, type ImportedRuleRow } from "@/lib/rules/importParse";
import { importRules } from "@/server/actions/rules";
import type { SubcategoryOption } from "@/lib/categories/types";

const norm = (s: string) => s.trim().toLowerCase();

export function RuleImport({
  subcategoryOptions,
}: {
  subcategoryOptions: SubcategoryOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportedRuleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [applyUncat, setApplyUncat] = useState(true);

  const { existingCats, existingSubs } = useMemo(() => {
    const cats = new Set<string>();
    const subs = new Set<string>();
    for (const o of subcategoryOptions) {
      cats.add(norm(o.categoryName));
      subs.add(`${norm(o.categoryName)}|${norm(o.subName ?? "—")}`);
    }
    return { existingCats: cats, existingSubs: subs };
  }, [subcategoryOptions]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const newCats = new Set<string>();
    let newSubs = 0;
    for (const r of rows) {
      const catNew = !existingCats.has(norm(r.category));
      if (catNew) newCats.add(norm(r.category));
      const subNew = catNew || !existingSubs.has(`${norm(r.category)}|${norm(r.subcategory)}`);
      if (subNew) newSubs += 1;
    }
    return { newCats: newCats.size, newSubs };
  }, [rows, existingCats, existingSubs]);

  function reset() {
    setRows(null);
    setError(null);
    setApplyUncat(true);
  }

  async function handleFile(file: File) {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseRulesText(decodeTextFile(bytes));
      if (parsed.length === 0) {
        setError(
          "Aucune règle détectée. Attendu : 2 colonnes « Catégorie.Sous-catégorie » et « %motif% ».",
        );
        return;
      }
      setRows(parsed);
    } catch {
      setError("Lecture du fichier impossible.");
    }
  }

  async function handleImport() {
    if (!rows) return;
    setImporting(true);
    const res = await importRules(rows, applyUncat);
    setImporting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { rulesCreated, categoriesCreated, subcategoriesCreated, skipped, applied } = res.summary;
    const parts = [`${rulesCreated} règle(s) créée(s)`];
    if (categoriesCreated || subcategoriesCreated)
      parts.push(`${categoriesCreated} cat. / ${subcategoriesCreated} sous-cat. créées`);
    if (applied) parts.push(`${applied} transaction(s) catégorisée(s)`);
    if (skipped) parts.push(`${skipped} ignorée(s)`);
    toast.success(parts.join(" · "));
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <>
      <Button
        variant="secondary"
        leftIcon={<Upload size={16} />}
        onClick={() => setOpen(true)}
      >
        Importer des règles
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Importer des règles"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {error && <Alert variant="danger">{error}</Alert>}

          {!rows ? (
            <>
              <Alert variant="info">
                Fichier à 2 colonnes : <strong>Catégorie.Sous-catégorie</strong> puis{" "}
                <strong>%motif%</strong> (inclusion). Séparateur tab, « ; » ou « , ».
                Les catégories manquantes sont créées.
              </Alert>
              <FileDropzone
                onFile={handleFile}
                accept=".csv,.tsv,.txt,text/csv"
                hint="Fichier CSV / TSV de règles (10 Mo max)"
              />
            </>
          ) : (
            <>
              <div style={{ fontSize: "var(--text-sm)" }}>
                <strong>{rows.length}</strong> règle{rows.length > 1 ? "s" : ""}
                {stats && (stats.newCats > 0 || stats.newSubs > 0) && (
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {" "}· {stats.newCats} catégorie(s) et {stats.newSubs} sous-catégorie(s) à créer
                  </span>
                )}
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                <Toggle checked={applyUncat} onChange={(e) => setApplyUncat(e.target.checked)} />
                Appliquer aux transactions non catégorisées existantes
              </label>

              <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto" }}>
                <table className="table-import-preview">
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th>Sous-catégorie</th>
                      <th>Contient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r, i) => {
                      const catNew = !existingCats.has(norm(r.category));
                      const subNew = catNew || !existingSubs.has(`${norm(r.category)}|${norm(r.subcategory)}`);
                      return (
                        <tr key={i}>
                          <td>
                            {r.category}
                            {catNew && <span style={{ color: "var(--color-info-dark)", marginLeft: 6, fontSize: "var(--text-xs)" }}>nouveau</span>}
                          </td>
                          <td>
                            {r.subcategory}
                            {subNew && <span style={{ color: "var(--color-info-dark)", marginLeft: 6, fontSize: "var(--text-xs)" }}>nouveau</span>}
                          </td>
                          <td>
                            <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>
                              {r.match}
                            </code>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
                    … et {rows.length - 200} autre(s).
                  </p>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
                <Button variant="secondary" onClick={reset}>
                  Changer de fichier
                </Button>
                <Button loading={importing} onClick={handleImport}>
                  Importer {rows.length} règle{rows.length > 1 ? "s" : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
