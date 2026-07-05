import { z } from "zod";
import { isValidRegex } from "./matcher";

const nullableNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number().finite("Montant invalide").nullable(),
);

const nullableUuid = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.string().uuid().nullable(),
);

export const ruleSchema = z
  .object({
    name: z.string().trim().min(1, "Nom requis").max(120, "120 caractères max"),
    match_type: z.enum(["regex", "exact", "contains"]),
    pattern: z.string().trim().min(1, "Motif requis"),
    case_sensitive: z.coerce.boolean().default(false),
    amount_min: nullableNumber,
    amount_max: nullableNumber,
    account_id: nullableUuid,
    merchant_id: nullableUuid,
    subcategory_id: z.string().uuid("Sous-catégorie requise"),
    auto_validate: z.coerce.boolean().default(true),
    priority: z.coerce
      .number()
      .int("Entier requis")
      .min(0)
      .max(32000)
      .default(100),
    is_active: z.coerce.boolean().default(true),
  })
  .refine(
    (data) => data.match_type !== "regex" || isValidRegex(data.pattern),
    { message: "Expression régulière invalide", path: ["pattern"] },
  )
  .refine(
    (data) =>
      data.amount_min == null ||
      data.amount_max == null ||
      data.amount_min <= data.amount_max,
    { message: "Le minimum doit être ≤ au maximum", path: ["amount_max"] },
  );

export type RuleInput = z.input<typeof ruleSchema>;
export type RuleValues = z.output<typeof ruleSchema>;
