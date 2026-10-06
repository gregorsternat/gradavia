import { pageMetadata } from "@/features/seo/domain/metadata";
import { loadSources } from "@/features/observatory/server/load";
import { Sources } from "@/features/observatory/ui/sources";
export const metadata = pageMetadata("/sources");
export const dynamic = "force-dynamic";
export default async function Page() {
  return <Sources result={await loadSources()} />;
}
