import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={className ? `card-surface ${className}` : "card-surface"}
      {...props}
    >
      {children}
    </div>
  );
}

interface InteractiveCardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  children: ReactNode;
}

export function InteractiveCard({
  selected,
  children,
  className,
  ...props
}: InteractiveCardProps) {
  return (
    <div
      className={
        className ? `card-interactive ${className}` : "card-interactive"
      }
      data-selected={selected || undefined}
      tabIndex={0}
      role="button"
      {...props}
    >
      {children}
    </div>
  );
}
