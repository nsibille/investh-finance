import Link from "next/link";
import type { ReactNode } from "react";
import { Amount } from "@/components/ui/Amount";

/**
 * `purchase-line-row` — ligne compacte, type transaction, en lecture seule.
 * Sert à lister les transactions rattachées à un achat comme ses sous-achats
 * (« les lister comme des transactions »). Cliquable si `href` est fourni.
 */
export function PurchaseLineRow({
  href,
  leading,
  label,
  sublabel,
  amount,
  currency,
  amountTone = "auto",
  trailing,
}: {
  href?: string;
  leading?: ReactNode;
  label: string;
  sublabel?: ReactNode;
  amount?: number;
  currency?: string;
  amountTone?: "auto" | "neutral" | "positive" | "negative";
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      {leading}
      <span className="purchase-line-row__main">
        <span className="purchase-line-row__label">{label}</span>
        {sublabel != null && (
          <span className="purchase-line-row__sub">{sublabel}</span>
        )}
      </span>
      {amount != null && (
        <Amount value={amount} currency={currency} size="sm" tone={amountTone} />
      )}
      {trailing}
    </>
  );

  return href ? (
    <Link href={href} className="purchase-line-row">
      {inner}
    </Link>
  ) : (
    <div className="purchase-line-row">{inner}</div>
  );
}
