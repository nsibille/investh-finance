import {
  PageHeaderSkeleton,
  ChartCardSkeleton,
  CardSkeleton,
} from "@/components/layout/PageSkeleton";

export default function AnalyticsLoading() {
  return (
    <>
      <PageHeaderSkeleton withActions />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        <ChartCardSkeleton height={280} />
        <ChartCardSkeleton height={280} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: "var(--space-6)",
          }}
        >
          <CardSkeleton lines={6} />
          <CardSkeleton lines={6} />
        </div>
      </div>
    </>
  );
}
