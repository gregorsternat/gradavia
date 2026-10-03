import { Suspense } from "react";
import { loadOverview } from "@/features/observatory/server/load";
import { Overview } from "@/features/observatory/ui/overview";
import ObservatoryLoading from "@/features/observatory/ui/loading";

type HomeProps = {
  searchParams: Promise<{ campagne?: string }>;
};

async function OverviewContent({ searchParams }: HomeProps) {
  const { campagne } = await searchParams;
  return <Overview result={await loadOverview(campagne)} />;
}

export default function Home(props: HomeProps) {
  return (
    <Suspense fallback={<ObservatoryLoading />}>
      <OverviewContent {...props} />
    </Suspense>
  );
}
