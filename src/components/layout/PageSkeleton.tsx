import type { CSSProperties } from "react";
import { SkeletonLine, SkeletonBlock } from "@/components/ui/Skeleton";

/**
 * Squelettes de page — compositions des slugs `skeleton-line` / `skeleton-block`
 * (voir DESIGN_SYSTEM.md § skeleton). Utilisés par les fichiers `loading.tsx`
 * de chaque segment pour afficher un aperçu instantané pendant le rendu serveur.
 */

const col: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-6)",
};

/** En-tête de page (titre + sous-titre), calqué sur `layout-page-header`. */
export function PageHeaderSkeleton({ withActions }: { withActions?: boolean }) {
  return (
    <div className="layout-page-header">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <SkeletonLine width={200} />
        <SkeletonLine width={320} />
      </div>
      {withActions && (
        <div className="layout-page-header__actions">
          <SkeletonBlock height={40} style={{ width: 140, borderRadius: "var(--radius-md)" }} />
        </div>
      )}
    </div>
  );
}

/** Carte générique avec quelques lignes de texte. */
export function CardSkeleton({
  lines = 3,
  height,
}: {
  lines?: number;
  height?: number;
}) {
  return (
    <div className="card-surface">
      {height ? (
        <SkeletonBlock height={height} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {Array.from({ length: lines }).map((_, i) => (
            <SkeletonLine key={i} width={i === lines - 1 ? "60%" : "100%"} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Carte « graphique » : titre + zone de tracé. */
export function ChartCardSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div className="card-surface">
      <SkeletonLine width={180} />
      <div style={{ marginTop: "var(--space-4)" }}>
        <SkeletonBlock height={height} />
      </div>
    </div>
  );
}

/** Rangée de KPI (dashboard). */
export function KpiRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "var(--space-4)",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} height={72} />
      ))}
    </div>
  );
}

/** Grille de cartes (comptes, connexions…). */
export function CardGridSkeleton({
  count = 6,
  minWidth = 260,
  height = 96,
}: {
  count?: number;
  minWidth?: number;
  height?: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
        gap: "var(--space-4)",
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} height={height} />
      ))}
    </div>
  );
}

/** Tableau (transactions, règles…) : barre de filtres + lignes. */
export function TableSkeleton({
  rows = 8,
  withFilters = true,
}: {
  rows?: number;
  withFilters?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {withFilters && (
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock
              key={i}
              height={38}
              style={{ width: 160, borderRadius: "var(--radius-md)" }}
            />
          ))}
        </div>
      )}
      <div className="card-surface">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
              }}
            >
              <SkeletonBlock height={32} style={{ width: 32, borderRadius: "var(--radius-full)" }} />
              <SkeletonLine width="30%" />
              <SkeletonLine width="20%" />
              <span style={{ flex: 1 }} />
              <SkeletonLine width={80} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Enveloppe verticale standard pour composer une page de squelettes. */
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return <div style={col}>{children}</div>;
}
