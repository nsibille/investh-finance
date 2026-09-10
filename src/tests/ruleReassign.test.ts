import { describe, it, expect } from "vitest";
import { selectStaleRuleIds } from "@/server/rules/reassign";

describe("selectStaleRuleIds", () => {
  const candidates = [
    { id: "r1", merchant_id: "nameless-courses" },
    { id: "r2", merchant_id: "nameless-resto" },
    { id: "r3", merchant_id: "carrefour" },
  ];

  it("keeps only rules attached to nameless merchants", () => {
    expect(
      selectStaleRuleIds(candidates, ["nameless-courses", "nameless-resto"]),
    ).toEqual(["r1", "r2"]);
  });

  it("never targets a named enseigne (not in the nameless set)", () => {
    expect(selectStaleRuleIds(candidates, ["nameless-courses"])).toEqual(["r1"]);
    expect(
      selectStaleRuleIds(candidates, ["nameless-courses"]).includes("r3"),
    ).toBe(false);
  });

  it("returns nothing when no candidate is nameless", () => {
    expect(selectStaleRuleIds(candidates, [])).toEqual([]);
  });
});
