"use client";

import dynamic from "next/dynamic";
import { SkeletonBlock } from "@/components/ui/Skeleton";

/**
 * Chargement paresseux des graphiques (recharts est lourd : ~exclu du bundle
 * initial). Chaque wrapper affiche un `skeleton-block` pendant le téléchargement
 * du chunk. `ssr: false` : les graphiques ne rendent rien côté serveur, ils
 * s'hydratent à l'arrivée du chunk — la navigation reste instantanée.
 */

function ChartLoading({ height }: { height: number }) {
  return <SkeletonBlock height={height} />;
}

const chartFallback = (height: number) => {
  const Loading = () => <ChartLoading height={height} />;
  Loading.displayName = "ChartLoading";
  return Loading;
};

export const BarMonthly = dynamic(
  () => import("./BarMonthly").then((m) => m.BarMonthly),
  { ssr: false, loading: chartFallback(300) },
);

export const PieCategories = dynamic(
  () => import("./PieCategories").then((m) => m.PieCategories),
  { ssr: false, loading: chartFallback(300) },
);

export const DashboardFlowChart = dynamic(
  () => import("./DashboardFlowChart").then((m) => m.DashboardFlowChart),
  { ssr: false, loading: chartFallback(300) },
);

export const TreasuryChart = dynamic(
  () => import("./TreasuryChart").then((m) => m.TreasuryChart),
  { ssr: false, loading: chartFallback(260) },
);

export const ComparisonChart = dynamic(
  () => import("./ComparisonChart").then((m) => m.ComparisonChart),
  { ssr: false, loading: chartFallback(300) },
);

export const NetWorthChart = dynamic(
  () => import("./NetWorthChart").then((m) => m.NetWorthChart),
  { ssr: false, loading: chartFallback(300) },
);

export const MerchantSpendChart = dynamic(
  () => import("./MerchantSpendChart").then((m) => m.MerchantSpendChart),
  { ssr: false, loading: chartFallback(200) },
);

export const PurchaseTimelineChart = dynamic(
  () => import("./PurchaseTimelineChart").then((m) => m.PurchaseTimelineChart),
  { ssr: false, loading: chartFallback(200) },
);
