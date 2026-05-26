"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import { exportTransactions } from "@/server/actions/export";
import type { TransactionFilters, TransactionStatus } from "@/lib/transactions/types";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportMenu() {
  const params = useSearchParams();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  function currentFilters(): TransactionFilters {
    return {
      accountId: params.get("account") ?? undefined,
      status: (params.get("status") as TransactionStatus) || undefined,
      subcategoryId: params.get("subcategory") ?? undefined,
      search: params.get("q") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      sort: (params.get("sort") as TransactionFilters["sort"]) ?? undefined,
    };
  }

  async function run(kind: "csv" | "xlsx") {
    setBusy(true);
    try {
      const rows = await exportTransactions(currentFilters());
      if (rows.length === 0) {
        toast.info("Aucune transaction à exporter.");
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "csv") {
        const csv = Papa.unparse(rows);
        download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `lyra-transactions-${stamp}.csv`);
      } else {
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
        download(
          new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          `lyra-transactions-${stamp}.xlsx`,
        );
      }
      toast.success(`${rows.length} transactions exportées`);
      setOpen(false);
    } catch {
      toast.error("Export impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" leftIcon={<Download size={16} />} onClick={() => setOpen(true)}>
        Exporter
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Exporter les transactions"
        variantClass="modal-export-options"
      >
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginTop: 0 }}>
          Exporte les transactions correspondant aux filtres actuels.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <Button loading={busy} onClick={() => run("csv")}>CSV</Button>
          <Button variant="secondary" loading={busy} onClick={() => run("xlsx")}>Excel (.xlsx)</Button>
        </div>
      </Modal>
    </>
  );
}
