import { explorerMetadata } from "@/features/seo/domain/metadata";
import { loadExplorer } from "@/features/formations/server/load";
import { FormationExplorer } from "@/features/formations/ui/explorer";
import {
  explorerUrl,
  parseQuery,
  type SearchParams,
} from "@/features/formations/domain/explorer";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return explorerMetadata(await loadExplorer(await searchParams));
}

export default async function FormationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = parseQuery(params);
  return (
    <FormationExplorer
      result={await loadExplorer(params)}
      retryUrl={explorerUrl(query, query.page)}
      initialView={
        params.vue === "cartes"
          ? "cartes"
          : params.vue === "liste"
            ? "liste"
            : undefined
      }
    />
  );
}
