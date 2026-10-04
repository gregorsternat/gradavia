import type { Metadata } from "next";
import { Suspense } from "react";
import { loadOverview } from "@/features/observatory/server/load";
import { Overview } from "@/features/observatory/ui/overview";
import ObservatoryLoading from "@/features/observatory/ui/loading";

export const metadata: Metadata = {
  title: "Vue d’ensemble",
  description:
    "Explorez les formations, les places proposées et les admissions Parcoursup par campagne, avec les sources et leur couverture.",
};

type ObservatoryProps = {
  searchParams: Promise<{ campagne?: string }>;
};

async function OverviewContent({ searchParams }: ObservatoryProps) {
  const { campagne } = await searchParams;
  return <Overview result={await loadOverview(campagne)} />;
}

export default function Observatory(props: ObservatoryProps) {
  return (
    <Suspense fallback={<ObservatoryLoading />}>
      <OverviewContent {...props} />
    </Suspense>
  );
}
