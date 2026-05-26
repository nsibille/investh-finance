import { z } from "zod";

const nullableNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite("Montant invalide").nullable(),
);

const nullableUuid = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().uuid().nullable(),
);

export const recurringSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120, "120 caractères max"),
  account_id: nullableUuid,
  subcategory_id: nullableUuid,
  expected_amount: nullableNumber,
  amount_tolerance: z.coerce.number().min(0).max(100).default(5),
  frequency_days: z.coerce.number().int().min(1).max(400).default(30),
  label_pattern: z.string().trim().max(200).optional().or(z.literal("")),
  alert_if_missing: z.coerce.boolean().default(true),
});

export type RecurringInput = z.input<typeof recurringSchema>;
