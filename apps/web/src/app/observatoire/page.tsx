import type { SearchParams } from "@/features/formations/domain/explorer";
import { pageMetadata } from "@/features/seo/domain/metadata";
import { Suspense } from "react";
import { loadOverview } from "@/features/observatory/server/load";
import { Overview } from "@/features/observatory/ui/overview";
import ObservatoryLoading from "@/features/observatory/ui/loading";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return pageMetadata("/observatoire", await searchParams);
}

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
