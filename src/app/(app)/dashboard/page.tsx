import { PageHeader } from "@/components/layout/PageHeader";
import { ComingSoon } from "@/components/layout/ComingSoon";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Vue d'ensemble mensuelle de tes finances."
      />
      <ComingSoon feature="Le dashboard mensuel" />
    </>
  );
}
