import type { Database } from "@/types/database.types";

export type MatchType = Database["public"]["Enums"]["rule_match_type"];

export interface MatchableRule {
  match_type: MatchType;
  pattern: string;
  case_sensitive: boolean;
}

/** Returns whether a raw transaction label matches a rule. */
export function matchRule(rule: MatchableRule, rawLabel: string): boolean {
  if (!rule.pattern) return false;

  if (rule.match_type === "regex") {
    try {
      const re = new RegExp(rule.pattern, rule.case_sensitive ? "" : "i");
      return re.test(rawLabel);
    } catch {
      // Invalid regex never matches (and should be blocked at save time).
      return false;
    }
  }

  const subject = rule.case_sensitive ? rawLabel : rawLabel.toLowerCase();
  const pattern = rule.case_sensitive
    ? rule.pattern
    : rule.pattern.toLowerCase();

  if (rule.match_type === "exact") {
    return subject.trim() === pattern.trim();
  }
  // contains
  return subject.includes(pattern);
}

/** Validates a regex pattern string. */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
