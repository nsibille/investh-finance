import { z } from "zod";

export const accountSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom est requis")
    .max(80, "80 caractères maximum"),
  type: z.enum([
    "checking",
    "savings",
    "pel",
    "joint",
    "investment",
    "other",
  ]),
  bank: z.string().trim().max(80, "80 caractères maximum").optional().or(z.literal("")),
  connection_name: z
    .string()
    .trim()
    .max(120, "120 caractères maximum")
    .optional()
    .or(z.literal("")),
  initial_balance: z.coerce
    .number({ message: "Montant invalide" })
    .finite("Montant invalide"),
  initial_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Code devise sur 3 lettres (ex: EUR)")
    .default("EUR"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur hexadécimale invalide")
    .default("#5B5BD6"),
});

export type AccountInput = z.input<typeof accountSchema>;
export type AccountValues = z.output<typeof accountSchema>;
