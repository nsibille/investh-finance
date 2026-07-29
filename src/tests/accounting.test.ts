import { describe, it, expect } from "vitest";
import {
  accountingDate,
  accountingMonth,
  INCOME_SHIFT_DAY,
} from "@/lib/dashboard/accounting";

describe("accountingDate", () => {
  it("laisse les dépenses sur leur date d'opération", () => {
    expect(accountingDate("2026-03-31", false)).toBe("2026-03-31");
    expect(accountingDate("2026-03-05", false)).toBe("2026-03-05");
  });

  it("laisse les revenus de début/milieu de mois inchangés", () => {
    expect(accountingDate("2026-03-01", true)).toBe("2026-03-01");
    expect(accountingDate("2026-03-24", true)).toBe("2026-03-24");
  });

  it("rattache un revenu daté au seuil au 1er du mois suivant", () => {
    expect(accountingDate("2026-03-25", true)).toBe("2026-04-01");
  });

  it("rattache un revenu de fin de mois au 1er du mois suivant", () => {
    expect(accountingDate("2026-03-27", true)).toBe("2026-04-01");
    expect(accountingDate("2026-03-31", true)).toBe("2026-04-01");
  });

  it("gère le passage d'année (décembre → janvier)", () => {
    expect(accountingDate("2026-12-28", true)).toBe("2027-01-01");
  });

  it("gère les mois courts (février)", () => {
    expect(accountingDate("2026-02-28", true)).toBe("2026-03-01");
  });

  it("le seuil est bien la limite inclusive", () => {
    expect(accountingDate(`2026-06-${INCOME_SHIFT_DAY - 1}`, true)).toBe(
      `2026-06-${INCOME_SHIFT_DAY - 1}`,
    );
    expect(accountingDate(`2026-06-${INCOME_SHIFT_DAY}`, true)).toBe(
      "2026-07-01",
    );
  });
});

describe("accountingMonth", () => {
  it("renvoie le mois d'opération pour une dépense", () => {
    expect(accountingMonth("2026-03-31", false)).toBe("2026-03");
  });

  it("renvoie le mois suivant pour un revenu de fin de mois", () => {
    expect(accountingMonth("2026-03-27", true)).toBe("2026-04");
    expect(accountingMonth("2026-12-30", true)).toBe("2027-01");
  });
});
