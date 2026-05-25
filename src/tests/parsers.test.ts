import { describe, it, expect } from "vitest";
import { detectBank } from "@/lib/import/parsers/detect";
import { parseBforBank } from "@/lib/import/parsers/bforbank";
import {
  parseSocieteGenerale,
  inferSgSign,
} from "@/lib/import/parsers/societegenerale";

// Synthetic, format-accurate fixtures (no real personal data).
const BFOR_TEXT = [
  "BforBank Relevé mensuel de compte bancaire nº 12345678",
  "Du 01/04/2026 au 30/04/2026",
  "Date de l'opération Date de valeur Libellé de l'opération Débit Crédit",
  "01/04/2026 Votre ancien solde -10,00 €",
  "02/04/2026 02/04/2026 VIREMENT RECU TEST 200,00 €",
  "03/04/2026 03/04/2026 COTIS. ASSURANCE DEMO -2,00 €",
  "30/04/2026 30/04/2026 REGLEMENT CARTES DEBIT DIFFERE 1234-AVRIL 2026 -150,00 €",
  "30/04/2026 Votre nouveau solde 1 038,00 €",
  "Détail de vos opérations en euros carte Carte Visa premier",
  "Date de l'opération Libellé de l'opération Débit Crédit",
  "26/03/2026 PAIEMENT PAR CARTE U EXPRESS FR75PARIS 250326 000000 1234 501970 22,25 €",
  "28/03/2026 PAIEMENT PAR CARTE WEB UBER NLAMSTERDAM 270326 000000 1234 426604 14,37 EUR 1EUR=0,000 EUR 14,37",
  "10/04/2026 AVOIR SUR PAIEMENT CARTE WEB DEMO 090426 123328 1234 54,98 €",
  "Total 36,62 € 54,98 €",
].join(" ");

const SG_TEXT = [
  "Société Générale RELEVÉ DE COMPTE",
  "RELEVÉ DES OPÉRATIONS Date Valeur Nature de l'opération Débit Crédit",
  "SOLDE PRÉCÉDENT AU 04/04/2026 1.000,00",
  "07/04/2026 07/04/2026 PRELEVEMENT EUROPEEN 0213741950 DE: DEMO MOTIF: x 90,80",
  "10/04/2026 10/04/2026 000001 VIR INSTANTANE EMIS LOGITEL POUR: Ines REF: 1 75,00",
  "29/04/2026 29/04/2026 VIR INST RE 661996781286 DE: EMPLOYEUR MOTIF: Salaire 5.796,58",
  "TOTAUX DES MOUVEMENTS 165,80 5.796,58 NOUVEAU SOLDE AU 06/05/2026 + 6.630,78",
].join(" ");

describe("detectBank", () => {
  it("detects BforBank", () => {
    expect(detectBank(BFOR_TEXT)).toBe("bforbank");
  });
  it("detects Société Générale even with a BFBKFRP1 transfer line", () => {
    expect(detectBank(SG_TEXT + " CHEZ: BFBKFRP1XXX")).toBe("societegenerale");
  });
  it("returns null for unknown", () => {
    expect(detectBank("relevé inconnu")).toBeNull();
  });
});

describe("parseBforBank", () => {
  const txs = parseBforBank(BFOR_TEXT);

  it("skips solde lines and the deferred-debit settlement", () => {
    expect(txs.some((t) => /solde/i.test(t.label))).toBe(false);
    expect(txs.some((t) => /REGLEMENT CARTES/i.test(t.label))).toBe(false);
  });

  it("keeps the signed main amounts", () => {
    const credit = txs.find((t) => t.label.includes("VIREMENT RECU"));
    const debit = txs.find((t) => t.label.includes("COTIS"));
    expect(credit?.amount).toBe(200);
    expect(debit?.amount).toBe(-2);
  });

  it("makes card payments negative and refunds (AVOIR) positive", () => {
    const card = txs.find((t) => t.label.includes("U EXPRESS"));
    const fx = txs.find((t) => t.label.includes("UBER"));
    const avoir = txs.find((t) => t.label.includes("AVOIR"));
    expect(card?.amount).toBe(-22.25);
    expect(fx?.amount).toBe(-14.37);
    expect(avoir?.amount).toBe(54.98);
  });

  it("reconciles to the statement balance delta", () => {
    const sum = txs.reduce((s, t) => s + t.amount, 0);
    // 200 - 2 - 22.25 - 14.37 + 54.98 = 216.36
    expect(sum).toBeCloseTo(216.36, 2);
  });
});

describe("inferSgSign", () => {
  it("debits prélèvements and emitted transfers", () => {
    expect(inferSgSign("PRELEVEMENT EUROPEEN DE: X")).toBe(-1);
    expect(inferSgSign("VIR INSTANTANE EMIS POUR: Y")).toBe(-1);
  });
  it("credits received transfers", () => {
    expect(inferSgSign("VIR INST RE DE: Z")).toBe(1);
    expect(inferSgSign("VIR RECU DE: W")).toBe(1);
  });
});

describe("parseSocieteGenerale", () => {
  const txs = parseSocieteGenerale(SG_TEXT);

  it("parses all operations with inferred signs", () => {
    expect(txs).toHaveLength(3);
    const prelev = txs.find((t) => t.label.includes("PRELEVEMENT"));
    const emis = txs.find((t) => t.label.includes("EMIS"));
    const salaire = txs.find((t) => t.label.includes("Salaire"));
    expect(prelev?.amount).toBe(-90.8);
    expect(emis?.amount).toBe(-75);
    expect(salaire?.amount).toBe(5796.58);
  });

  it("reconciles to the statement balance delta", () => {
    const sum = txs.reduce((s, t) => s + t.amount, 0);
    expect(sum).toBeCloseTo(5630.78, 2);
  });
});
