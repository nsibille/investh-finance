type Size = "sm" | "md" | "lg";

export function Spinner({ size = "md" }: { size?: Size }) {
  return (
    <span className={`spinner-${size}`} role="status" aria-label="Chargement" />
  );
}
