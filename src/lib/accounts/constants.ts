import type { Database } from "@/types/database.types";

export type AccountType = Database["public"]["Enums"]["account_type"];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Compte courant",
  savings: "Livret",
  pel: "PEL",
  joint: "Compte joint",
  investment: "Investissement",
  other: "Autre",
};

export const ACCOUNT_TYPE_OPTIONS = (
  Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]
).map((value) => ({ value, label: ACCOUNT_TYPE_LABELS[value] }));

export const ACCOUNT_COLORS = [
  "#5B5BD6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#F97316",
  "#71717A",
];
