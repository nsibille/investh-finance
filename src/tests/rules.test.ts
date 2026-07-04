import { describe, it, expect } from "vitest";
import { matchRule, isValidRegex } from "@/lib/rules/matcher";
import { applyRules, type EngineRule } from "@/lib/rules/engine";
import { suggestPattern, fullPattern } from "@/lib/rules/suggester";

describe("matchRule", () => {
  it("matches regex case-insensitively by default", () => {
    expect(
      matchRule(
        { match_type: "regex", pattern: "^CB CARREFOUR", case_sensitive: false },
        "cb carrefour paris 12",
      ),
    ).toBe(true);
  });

  it("respects case sensitivity for regex", () => {
    expect(
      matchRule(
        { match_type: "regex", pattern: "^CB", case_sensitive: true },
        "cb carrefour",
      ),
    ).toBe(false);
  });

  it("handles contains", () => {
    expect(
      matchRule(
        { match_type: "contains", pattern: "spotify", case_sensitive: false },
        "PAYPAL *SPOTIFY",
      ),
    ).toBe(true);
  });

  it("handles exact with trimming", () => {
    expect(
      matchRule(
        { match_type: "exact", pattern: "LOYER", case_sensitive: false },
        "  loyer  ",
      ),
    ).toBe(true);
  });

  it("invalid regex never matches", () => {
    expect(
      matchRule({ match_type: "regex", pattern: "[", case_sensitive: false }, "x"),
    ).toBe(false);
    expect(isValidRegex("[")).toBe(false);
    expect(isValidRegex("^ok$")).toBe(true);
  });
});

const baseRule = (over: Partial<EngineRule>): EngineRule => ({
  id: "r",
  match_type: "contains",
  pattern: "",
  case_sensitive: false,
  account_id: null,
  amount_min: null,
  amount_max: null,
  subcategory_id: "sub",
  auto_validate: true,
  priority: 100,
  is_active: true,
  ...over,
});

describe("applyRules", () => {
  it("returns pending fallback when nothing matches", () => {
    const out = applyRules(
      { account_id: "a", amount: -10, raw_label: "UNKNOWN" },
      [baseRule({ id: "1", pattern: "carrefour" })],
    );
    expect(out).toEqual({
      subcategory_id: null,
      status: "pending",
      applied_rule_id: null,
    });
  });

  it("applies the lowest-priority matching rule and auto-validates", () => {
    const out = applyRules(
      { account_id: "a", amount: -42, raw_label: "CB CARREFOUR" },
      [
        baseRule({ id: "low", pattern: "carrefour", priority: 200, subcategory_id: "B" }),
        baseRule({ id: "high", pattern: "carrefour", priority: 10, subcategory_id: "A" }),
      ],
    );
    expect(out.applied_rule_id).toBe("high");
    expect(out.subcategory_id).toBe("A");
    expect(out.status).toBe("validated");
  });

  it("skips inactive rules and rules for other accounts", () => {
    const out = applyRules(
      { account_id: "a", amount: -42, raw_label: "CB CARREFOUR" },
      [
        baseRule({ id: "inactive", pattern: "carrefour", is_active: false }),
        baseRule({ id: "otherAcct", pattern: "carrefour", account_id: "b" }),
        baseRule({ id: "ok", pattern: "carrefour", account_id: "a", priority: 50 }),
      ],
    );
    expect(out.applied_rule_id).toBe("ok");
  });

  it("respects amount bounds and pending when auto_validate is false", () => {
    const out = applyRules(
      { account_id: "a", amount: -5, raw_label: "FEE" },
      [
        baseRule({ id: "tooBig", pattern: "fee", amount_min: 0 }),
        baseRule({ id: "match", pattern: "fee", amount_max: 0, auto_validate: false, priority: 60 }),
      ],
    );
    expect(out.applied_rule_id).toBe("match");
    expect(out.status).toBe("pending");
  });
});

describe("suggestPattern", () => {
  it("keeps leading merchant tokens and drops the variable tail", () => {
    expect(suggestPattern("CB CARREFOUR PARIS 12")).toBe("^CB CARREFOUR PARIS");
  });

  it("escapes regex special characters", () => {
    expect(suggestPattern("PAYPAL *SPOTIFY")).toBe("^PAYPAL \\*SPOTIFY");
  });

  it("skips the generic card-payment boilerplate to capture the merchant", () => {
    expect(
      suggestPattern(
        "PAIEMENT PAR CARTE MC DONALDS FRNEUILLY SUR 220126 000000 8336 503071",
      ),
    ).toBe("^PAIEMENT PAR CARTE MC DONALDS FRNEUILLY");
  });

  it("handles the WEB variant of the boilerplate prefix", () => {
    expect(
      suggestPattern("PAIEMENT PAR CARTE WEB DELIVEROO FRPARIS 09 210126 000000"),
    ).toBe("^PAIEMENT PAR CARTE WEB DELIVEROO FRPARIS");
  });

  it("does not collapse two different merchants to the same generic pattern", () => {
    const monoprix = suggestPattern(
      "PAIEMENT PAR CARTE MONOPRIX FR75PARIS03SC 130126 000000",
    );
    const mcdo = suggestPattern(
      "PAIEMENT PAR CARTE MC DONALDS FRNEUILLY SUR 220126 000000",
    );
    expect(monoprix).not.toBe(mcdo);
  });

  it("returns empty string for blank input", () => {
    expect(suggestPattern("   ")).toBe("");
  });
});

describe("fullPattern", () => {
  it("anchors and escapes the whole normalised label", () => {
    expect(fullPattern("PAIEMENT PAR CARTE MONOPRIX 130126")).toBe(
      "^PAIEMENT PAR CARTE MONOPRIX 130126",
    );
  });

  it("collapses runs of whitespace and escapes special characters", () => {
    expect(fullPattern("  PAYPAL  *SPOTIFY  ")).toBe("^PAYPAL \\*SPOTIFY");
  });

  it("returns empty string for blank input", () => {
    expect(fullPattern("   ")).toBe("");
  });
});
