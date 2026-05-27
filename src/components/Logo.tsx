interface LogoProps {
  showWordmark?: boolean;
  size?: number;
}

export function Logo({ showWordmark = true, size = 28 }: LogoProps) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect width="32" height="32" rx="8" fill="var(--color-brand-primary)" />
        <path
          d="M11 8v12a4 4 0 0 0 4 4h6"
          stroke="var(--color-text-on-brand)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="21" cy="11" r="2.5" fill="var(--color-text-on-brand)" />
      </svg>
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-primary)",
            fontSize: "var(--text-lg)",
            fontWeight: "var(--fw-bold)",
            letterSpacing: "var(--tracking-tight)",
            color: "var(--color-text-primary)",
          }}
        >
          Lyra
        </span>
      )}
    </span>
  );
}
