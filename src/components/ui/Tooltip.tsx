import type { ReactNode } from "react";

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="tooltip-wrap">
      {children}
      <span className="tooltip-md" role="tooltip">
        {label}
      </span>
    </span>
  );
}
