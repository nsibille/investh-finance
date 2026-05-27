import { z } from "zod";

export const categorySchema = z.object({
  category_type_id: z.string().uuid("Type requis"),
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères max"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide")
    .optional()
    .or(z.literal("")),
});

export const subcategorySchema = z.object({
  category_id: z.string().uuid("Catégorie requise"),
  name: z.string().trim().min(1, "Nom requis").max(80, "80 caractères max"),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type SubcategoryInput = z.input<typeof subcategorySchema>;
