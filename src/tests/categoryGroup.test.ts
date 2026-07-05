import { describe, it, expect } from "vitest";
import { groupByCategory, preciseSubName } from "@/lib/categories/group";
import type { SubcategoryOption } from "@/lib/categories/types";

const opt = (
  id: string,
  typeName: string,
  categoryName: string,
  subName: string | null,
): SubcategoryOption => ({
  id,
  label: `${typeName} / ${categoryName}${subName ? ` / ${subName}` : ""}`,
  categoryColor: null,
  typeName,
  categoryName,
  subName,
});

// Ordre défini (sort_order) : Dépenses/Alimentation puis Dépenses/Transport
// puis Revenus/Salaire.
const options: SubcategoryOption[] = [
  opt("a1", "Dépenses", "Alimentation", "Courses"),
  opt("a2", "Dépenses", "Alimentation", null), // défaut
  opt("t1", "Dépenses", "Transport", "Essence"),
  opt("s1", "Revenus", "Salaire", null), // défaut
];

describe("preciseSubName", () => {
  it("retourne la sous-catégorie si nommée", () => {
    expect(preciseSubName(opt("x", "T", "Cat", "Sous"))).toBe("Sous");
  });
  it("retombe sur la catégorie parente si défaut", () => {
    expect(preciseSubName(opt("x", "T", "Cat", null))).toBe("Cat");
  });
});

describe("groupByCategory", () => {
  const items = [
    { id: "r1", subcategory_id: "t1" },
    { id: "r2", subcategory_id: "a1" },
    { id: "r3", subcategory_id: "s1" },
    { id: "r4", subcategory_id: "a2" },
    { id: "r5", subcategory_id: null },
    { id: "r6", subcategory_id: "inconnu" },
  ];
  const groups = groupByCategory(items, (i) => i.subcategory_id, options);

  it("respecte la hiérarchie et l'ordre défini", () => {
    expect(groups.map((g) => g.typeName)).toEqual([
      "Dépenses",
      "Revenus",
      "Sans catégorie",
    ]);
    const depenses = groups[0];
    expect(depenses.categories.map((c) => c.categoryName)).toEqual([
      "Alimentation",
      "Transport",
    ]);
  });

  it("regroupe les items d'une même catégorie (défaut inclus)", () => {
    const alim = groups[0].categories[0];
    expect(alim.items.map((i) => i.id).sort()).toEqual(["r2", "r4"]);
  });

  it("place les items sans catégorie (null/inconnu) en dernier", () => {
    const last = groups[groups.length - 1];
    expect(last.typeName).toBe("Sans catégorie");
    expect(last.categories[0].items.map((i) => i.id).sort()).toEqual([
      "r5",
      "r6",
    ]);
  });

  it("omet les catégories/types sans item", () => {
    const items2 = [{ id: "x", subcategory_id: "s1" }];
    const g = groupByCategory(items2, (i) => i.subcategory_id, options);
    expect(g).toHaveLength(1);
    expect(g[0].typeName).toBe("Revenus");
  });
});
