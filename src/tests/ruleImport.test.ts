import { describe, it, expect } from "vitest";
import { parseRulesText, detectDelimiter } from "@/lib/rules/importParse";

describe("parseRulesText", () => {
  it("parse Catégorie.Sous-catégorie + %motif% (tab)", () => {
    const text = "Restaurants.Uber\t%uber eats%\nTransports.Métro\t%ile-de-france%";
    expect(parseRulesText(text)).toEqual([
      { category: "Restaurants", subcategory: "Uber", match: "uber eats" },
      { category: "Transports", subcategory: "Métro", match: "ile-de-france" },
    ]);
  });

  it("sous-catégorie « — » par défaut quand une seule partie", () => {
    expect(parseRulesText("Loisirs\t%netflix%")).toEqual([
      { category: "Loisirs", subcategory: "—", match: "netflix" },
    ]);
  });

  it("ignore l'en-tête et les lignes vides", () => {
    const text = "Catégorie\tMotif\n\nAlimentation.Courses\t%carrefour%\n";
    expect(parseRulesText(text)).toEqual([
      { category: "Alimentation", subcategory: "Courses", match: "carrefour" },
    ]);
  });

  it("tolère un délimiteur (virgule) à l'intérieur du motif", () => {
    // délimiteur virgule, motif contenant une virgule → découpe sur la 1ʳᵉ
    const text = "Resto.Bistrot,%CARREFOUR, PARIS 15%";
    expect(detectDelimiter(text)).toBe(",");
    expect(parseRulesText(text)).toEqual([
      { category: "Resto", subcategory: "Bistrot", match: "CARREFOUR, PARIS 15" },
    ]);
  });

  it("retire les guillemets encadrants", () => {
    const text = '"Resto.Uber";"%uber%"';
    expect(parseRulesText(text)).toEqual([
      { category: "Resto", subcategory: "Uber", match: "uber" },
    ]);
  });
});
