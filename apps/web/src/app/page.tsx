import { pageMetadata } from "@/features/seo/domain/metadata";
import { websiteStructuredData } from "@/features/seo/domain/structured-data";
import { StructuredData } from "@/features/seo/ui/structured-data";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadOverview } from "@/features/observatory/server/load";
import { LandingPage } from "@/features/landing/ui/landing-page";
import {
  OverviewPreview,
  PreviewLoading,
} from "@/features/landing/ui/overview-preview";

export const metadata = pageMetadata("/");

async function Preview() {
  return <OverviewPreview result={await loadOverview()} />;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ campagne?: string | string[] }>;
}) {
  const { campagne } = await searchParams;
  const legacyCampaign = Array.isArray(campagne) ? campagne[0] : campagne;
  if (legacyCampaign && /^\d{4}$/.test(legacyCampaign)) {
    redirect(`/observatoire?campagne=${legacyCampaign}`);
  }
  return (
    <>
      <StructuredData data={websiteStructuredData} />
      <LandingPage
        preview={
          <Suspense fallback={<PreviewLoading />}>
            <Preview />
          </Suspense>
        }
      />
    </>
  );
}
