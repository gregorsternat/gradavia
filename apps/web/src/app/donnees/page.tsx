import type { Metadata } from "next";
import { loadSources } from "@/features/observatory/server/load";
import { DataAccess } from "@/features/atlas/ui/data-access";
export const metadata: Metadata = { title: "Réutiliser les données" };
export const dynamic = "force-dynamic";
export default async function Page() {
  return <DataAccess result={await loadSources()} />;
}
