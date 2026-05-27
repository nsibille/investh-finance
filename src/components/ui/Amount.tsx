import { formatCurrency } from "@/lib/format/currency";

type Size = "sm" | "md" | "lg" | "xl";
type Tone = "auto" | "positive" | "negative" | "neutral";

interface AmountProps {
  value: number;
  currency?: string;
  size?: Size;
  /** "auto" derives positive/negative from the sign. */
  tone?: Tone;
  /** Force an explicit sign prefix (+/−) even for positive values. */
  showSign?: boolean;
}

export function Amount({
  value,
  currency = "EUR",
  size = "md",
  tone = "auto",
  showSign = false,
}: AmountProps) {
  const resolvedTone =
    tone === "auto"
      ? value > 0
        ? "positive"
        : value < 0
          ? "negative"
          : "neutral"
      : tone;

  const formatted = formatCurrency(Math.abs(value), currency);
  const sign = value < 0 ? "−" : showSign ? "+" : "";

  return (
    <span className={`amount-display amount-${resolvedTone} amount-${size}`}>
      {sign}
      {formatted}
    </span>
  );
}
