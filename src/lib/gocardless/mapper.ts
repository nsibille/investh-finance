import type { ParsedTransaction } from "@/lib/import/types";
import type { GCTransaction } from "./types";

function buildRawLabel(tx: GCTransaction): string {
  const parts: string[] = [];
  if (tx.remittanceInformationUnstructured) {
    parts.push(tx.remittanceInformationUnstructured);
  }
  if (tx.remittanceInformationUnstructuredArray?.length) {
    parts.push(tx.remittanceInformationUnstructuredArray.join(" "));
  }
  const counterparty = tx.creditorName ?? tx.debtorName;
  if (counterparty) parts.push(counterparty);
  if (parts.length === 0 && tx.additionalInformation) {
    parts.push(tx.additionalInformation);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim() || "Opération bancaire";
}

/** Maps a GoCardless booked transaction to our source-agnostic shape. */
export function mapGoCardlessTransaction(tx: GCTransaction): ParsedTransaction {
  const raw = buildRawLabel(tx);
  const operationDate = (tx.bookingDate ?? tx.valueDate ?? "").slice(0, 10);
  return {
    operation_date: operationDate,
    value_date: tx.valueDate ? tx.valueDate.slice(0, 10) : null,
    label: raw.slice(0, 200),
    raw_label: raw,
    amount: Number(tx.transactionAmount.amount),
    currency: tx.transactionAmount.currency,
    external_id: tx.transactionId ?? tx.internalTransactionId ?? null,
  };
}

export function mapGoCardlessTransactions(
  txs: GCTransaction[],
): ParsedTransaction[] {
  return txs
    .map(mapGoCardlessTransaction)
    .filter((t) => t.operation_date && Number.isFinite(t.amount));
}
