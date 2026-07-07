import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const setShares = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
const getRepay = vi.fn(async (..._a: unknown[]) => ({
  operationDate: "2026-07-31",
  repayment: null,
}));
const onSaved = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));
vi.mock("@/server/actions/persons", () => ({
  setTransactionShares: (...a: unknown[]) => setShares(...a),
  getTransactionRepayment: (...a: unknown[]) => getRepay(...a),
  addRepayment: vi.fn(async () => ({ ok: true })),
  updateRepayment: vi.fn(async () => ({ ok: true })),
  deleteRepayment: vi.fn(async () => ({ ok: true })),
}));

import { PersonSharePicker } from "@/components/persons/PersonSharePicker";
import type { PersonOption } from "@/lib/persons/types";

const persons: PersonOption[] = [
  { id: "self-1", name: "Moi", isSelf: true, color: "#5B5BD6" },
  { id: "celia-1", name: "Célia", isSelf: false, color: "#E5484D" },
];

beforeEach(() => { cleanup(); setShares.mockClear(); onSaved.mockClear(); });

describe("PersonSharePicker — enregistrement du partage (débit)", () => {
  it("enregistre une part avec la personne cochée", async () => {
    render(
      <PersonSharePicker
        transactionId="tx-1"
        amount={-20}
        currency="EUR"
        persons={persons}
        initial={{ nature: null, shares: [] }}
        onSaved={onSaved}
      />,
    );

    // Coche Célia (redistribue 10/10)
    fireEvent.click(screen.getByText("Célia"));
    // Enregistre
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer le partage/ }));

    await waitFor(() => expect(setShares).toHaveBeenCalledTimes(1));
    const [id, input] = setShares.mock.calls[0] as unknown as [
      string,
      { nature: string; shares: { personId: string; amount: number }[] },
    ];
    expect(id).toBe("tx-1");
    expect(input.shares.map((s) => s.personId).sort()).toEqual(["celia-1", "self-1"]);
    for (const s of input.shares) expect(Number.isFinite(s.amount)).toBe(true);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
