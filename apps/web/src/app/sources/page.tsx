import type { Metadata } from "next";
import { loadSources } from "@/features/observatory/server/load";
import { Sources } from "@/features/observatory/ui/sources";
export const metadata: Metadata = { title: "Données & méthode" };
export const dynamic = "force-dynamic";
export default async function Page() {
  return <Sources result={await loadSources()} />;
}
