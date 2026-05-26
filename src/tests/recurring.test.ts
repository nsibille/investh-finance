import { describe, it, expect } from "vitest";
import {
  detectRecurringCandidates,
  recurringKey,
  type RecurringInput,
} from "@/lib/recurring/detector";
import { matchesPattern, patternStatus } from "@/lib/recurring/checker";

describe("recurringKey", () => {
  it("drops volatile digits to group monthly variants", () => {
    expect(recurringKey("PRELEVEMENT EUROPEEN 0213741950 DE: Navigo Annuel")).toBe(
      recurringKey("PRELEVEMENT EUROPEEN 3014519192 DE: Navigo Annuel"),
    );
  });
});

describe("detectRecurringCandidates", () => {
  it("detects a monthly recurrence with >= 3 occurrences", () => {
    const txs: RecurringInput[] = [
      { account_id: "a", raw_label: "PRLV 111 NAVIGO ANNUEL", amount: -90.8, operation_date: "2026-02-07" },
      { account_id: "a", raw_label: "PRLV 222 NAVIGO ANNUEL", amount: -90.8, operation_date: "2026-03-07" },
      { account_id: "a", raw_label: "PRLV 333 NAVIGO ANNUEL", amount: -90.8, operation_date: "2026-04-07" },
    ];
    const out = detectRecurringCandidates(txs);
    expect(out).toHaveLength(1);
    expect(out[0].occurrences).toBe(3);
    expect(out[0].expected_amount).toBe(-90.8);
    expect(out[0].last_seen_at).toBe("2026-04-07");
    expect(out[0].name.toLowerCase()).toContain("navigo");
  });

  it("ignores irregular or too-few occurrences", () => {
    const txs: RecurringInput[] = [
      { account_id: "a", raw_label: "CB SHOP", amount: -10, operation_date: "2026-01-03" },
      { account_id: "a", raw_label: "CB SHOP", amount: -10, operation_date: "2026-01-09" },
      { account_id: "a", raw_label: "CB SHOP", amount: -10, operation_date: "2026-01-11" },
    ];
    expect(detectRecurringCandidates(txs)).toHaveLength(0);
  });
});

describe("matchesPattern", () => {
  const pattern = {
    account_id: "a",
    expected_amount: -90.8,
    amount_tolerance: 5,
    frequency_days: 30,
    label_pattern: "NAVIGO ANNUEL",
    last_seen_at: "2026-04-07",
    alert_if_missing: true,
  };

  it("matches within amount tolerance and label", () => {
    expect(
      matchesPattern(pattern, {
        account_id: "a",
        raw_label: "PRLV 999 NAVIGO ANNUEL COMUTITRES",
        amount: -91.5,
        operation_date: "2026-05-07",
      }),
    ).toBe(true);
  });

  it("rejects other account or label", () => {
    expect(
      matchesPattern(pattern, { account_id: "b", raw_label: "NAVIGO ANNUEL", amount: -90.8, operation_date: "2026-05-07" }),
    ).toBe(false);
    expect(
      matchesPattern(pattern, { account_id: "a", raw_label: "AUTRE CHOSE", amount: -90.8, operation_date: "2026-05-07" }),
    ).toBe(false);
  });
});

describe("patternStatus", () => {
  const pattern = {
    account_id: "a",
    expected_amount: -90.8,
    amount_tolerance: 5,
    frequency_days: 30,
    label_pattern: "NAVIGO",
    last_seen_at: "2026-04-07",
    alert_if_missing: true,
  };

  it("is missing when overdue beyond grace", () => {
    expect(patternStatus(pattern, "2026-04-07", new Date("2026-05-20"))).toBe("missing");
  });
  it("is upcoming before the due date", () => {
    expect(patternStatus(pattern, "2026-04-07", new Date("2026-04-20"))).toBe("upcoming");
  });
  it("is active within grace", () => {
    expect(patternStatus(pattern, "2026-04-07", new Date("2026-05-10"))).toBe("active");
  });
});
