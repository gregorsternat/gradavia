import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { loadOverview } from "@/features/observatory/server/load";
import { LandingPage } from "@/features/landing/ui/landing-page";
import {
  OverviewPreview,
  PreviewLoading,
} from "@/features/landing/ui/overview-preview";

export const metadata: Metadata = {
  title: { absolute: "Gradavia — Votre orientation, les données en main" },
  description:
    "Explorez les formations Parcoursup, comparez les admissions et gardez vos favoris. Un observatoire indépendant, en accès libre, fondé sur les données publiques.",
};

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
    <LandingPage
      preview={
        <Suspense fallback={<PreviewLoading />}>
          <Preview />
        </Suspense>
      }
    />
  );
}
