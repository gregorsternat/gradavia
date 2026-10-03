import type { Metadata } from "next";
import { loadOverview } from "@/features/observatory/server/load";
import { Territories } from "@/features/observatory/ui/territories";
export const metadata: Metadata = { title: "Territoires" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ campagne?: string }>;
}) {
  const { campagne } = await searchParams;
  return <Territories result={await loadOverview(campagne)} />;
}
