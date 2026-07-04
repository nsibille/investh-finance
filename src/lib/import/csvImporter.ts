import { createClient } from "@/lib/supabase/server";
import { importParsedTransactions } from "./importer";
import { groupByConnection } from "./preview";
import { normalizeConnection } from "./connection";
import type { ParsedTransaction } from "./types";

export interface CsvImportSummary {
  rows_total: number;
  rows_imported: number;
  rows_duplicates: number;
  rows_auto_validated: number;
  accounts_created: number;
  accounts_touched: number;
}

/**
 * Import CSV multi-comptes : pour chaque « Nom de la connexion », rattache les
 * transactions au compte correspondant, ou le crée à la volée (valeurs par
 * défaut, pivot = connection_name), puis délègue au pipeline d'import commun.
 */
export async function importCsvTransactions(
  transactions: ParsedTransaction[],
  filename: string,
): Promise<CsvImportSummary> {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, connection_name");
  const accountIdByConnection = new Map<string, string>();
  for (const a of accounts ?? []) {
    if (a.connection_name) {
      accountIdByConnection.set(normalizeConnection(a.connection_name), a.id);
    }
  }

  const groups = groupByConnection(transactions);

  const summary: CsvImportSummary = {
    rows_total: 0,
    rows_imported: 0,
    rows_duplicates: 0,
    rows_auto_validated: 0,
    accounts_created: 0,
    accounts_touched: groups.size,
  };

  for (const [key, group] of groups) {
    let accountId = accountIdByConnection.get(key);

    if (!accountId) {
      const earliest = group.txs.reduce(
        (min, t) => (t.operation_date < min ? t.operation_date : min),
        group.txs[0].operation_date,
      );
      const { data: created, error } = await supabase
        .from("accounts")
        .insert({
          name: group.label.slice(0, 80),
          connection_name: group.label,
          type: "checking",
          initial_balance: 0,
          initial_date: earliest,
          currency: "EUR",
          color: "#5B5BD6",
        })
        .select("id")
        .single();
      if (error || !created) {
        throw new Error(error?.message ?? "Création du compte impossible");
      }
      accountId = created.id;
      accountIdByConnection.set(key, accountId);
      summary.accounts_created += 1;
    }

    const res = await importParsedTransactions(accountId, group.txs, {
      bankFormat: "csv:bankin",
      sourceFilename: filename,
    });
    summary.rows_total += res.rows_total;
    summary.rows_imported += res.rows_imported;
    summary.rows_duplicates += res.rows_duplicates;
    summary.rows_auto_validated += res.rows_auto_validated;
  }

  return summary;
}
