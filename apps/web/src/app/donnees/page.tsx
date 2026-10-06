import { pageMetadata } from "@/features/seo/domain/metadata";
import { loadSources } from "@/features/observatory/server/load";
import { DataAccess } from "@/features/atlas/ui/data-access";
export const metadata = pageMetadata("/donnees");
export const dynamic = "force-dynamic";
export default async function Page() {
  return <DataAccess result={await loadSources()} />;
}
