import { z } from "zod";

const nullableNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite("Montant invalide").nullable(),
);

const nullableUuid = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().uuid().nullable(),
);

const amountsArray = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v
          .map((x) => (x === "" || x == null ? NaN : Number(x)))
          .filter((n) => Number.isFinite(n))
      : [],
  z.array(z.number().finite()),
);

export const recurringSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120, "120 caractères max"),
  account_id: nullableUuid,
  merchant_id: nullableUuid,
  subcategory_id: nullableUuid,
  expected_amount: nullableNumber,
  expected_amounts: amountsArray.default([]),
  amount_tolerance: z.coerce.number().min(0).max(100).default(5),
  frequency_days: z.coerce.number().int().min(1).max(400).default(30),
  label_pattern: z.string().trim().max(500).optional().or(z.literal("")),
  alert_if_missing: z.coerce.boolean().default(true),
});

export type RecurringInput = z.input<typeof recurringSchema>;
