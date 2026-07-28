import { describe, it, expect } from "vitest";
import { segmentOf, SEGMENT_TYPE_SLUGS } from "@/lib/dashboard/segments";

describe("segmentOf", () => {
  it("classe tout revenu en « revenus », quel que soit le slug", () => {
    expect(segmentOf("revenus", true)).toBe("revenus");
    expect(segmentOf("autre", true)).toBe("revenus");
  });

  it("range Frais Fixes ET Prélèvements dans « fixes »", () => {
    expect(segmentOf("frais-fixes", false)).toBe("fixes");
    expect(segmentOf("prelevements", false)).toBe("fixes");
  });

  it("classe Frais Variables en « variables »", () => {
    expect(segmentOf("frais-variables", false)).toBe("variables");
  });

  it("classe les investissements séparément", () => {
    expect(segmentOf("investissements", false)).toBe("investissements");
  });

  it("exclut les virements internes (null)", () => {
    expect(segmentOf("virements", false)).toBeNull();
  });

  it("range une dépense de type inconnu en variable", () => {
    expect(segmentOf("importees", false)).toBe("variables");
    expect(segmentOf(null, false)).toBe("variables");
  });

  it("mappe fixes vers Frais Fixes + Prélèvements", () => {
    expect(SEGMENT_TYPE_SLUGS.fixes).toEqual(["frais-fixes", "prelevements"]);
    expect(SEGMENT_TYPE_SLUGS.variables).toEqual(["frais-variables"]);
  });
});
