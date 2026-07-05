import {
  PageSkeleton,
  KpiRowSkeleton,
  ChartCardSkeleton,
  CardSkeleton,
  CardGridSkeleton,
} from "@/components/layout/PageSkeleton";

export default function DashboardLoading() {
  return (
    <PageSkeleton>
      <section className="dashboard-hero">
        <div className="deco-aurora-gradient" />
        <div style={{ marginBottom: "var(--space-8)" }}>
          <div
            style={{
              height: 32,
              width: 220,
              borderRadius: "var(--radius-md)",
              background:
                "linear-gradient(90deg, var(--color-bg-subtle) 0%, var(--color-border) 50%, var(--color-bg-subtle) 100%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
            }}
          />
        </div>
        <KpiRowSkeleton />
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "var(--space-6)",
        }}
      >
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      <CardSkeleton height={40} />
      <CardGridSkeleton count={4} height={64} />
    </PageSkeleton>
  );
}
