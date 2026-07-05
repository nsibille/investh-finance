import { describe, it, expect } from "vitest";
import { isDeferredDebit } from "@/lib/import/deferred";

describe("isDeferredDebit", () => {
  it("détecte les libellés de débit différé (accents/casse ignorés)", () => {
    expect(isDeferredDebit("Debit Differe - M. Nicolas Sibille")).toBe(true);
    expect(isDeferredDebit("DÉBIT DIFFÉRÉ CARTE")).toBe(true);
    expect(isDeferredDebit("débit diff 1234")).toBe(true);
  });

  it("n'attrape pas les opérations normales", () => {
    expect(isDeferredDebit("CB U EXPRESS")).toBe(false);
    expect(isDeferredDebit("VIREMENT SEPA")).toBe(false);
    expect(isDeferredDebit("DIFFEREND FOURNISSEUR")).toBe(false);
  });
});
