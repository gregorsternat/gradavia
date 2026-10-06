import { pageMetadata } from "@/features/seo/domain/metadata";
import { loadAtlas } from "@/features/atlas/server/load";
import { fold } from "@/features/atlas/domain/exploration";
import type { AtlasData } from "@/features/atlas/domain/api-contract";
import { formationId } from "@/features/formations/domain/api-contract";
import type { SearchParams } from "@/features/formations/domain/explorer";
import {
  ModalityComparison,
  type ModalityChoice,
} from "@/features/atlas/ui/modality-comparison";

export const metadata = pageMetadata("/modalites");
export default async function ModalityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    ["classique", "apprenti", "q_classique", "q_apprenti", "campagne"].map(
      (key) => [
        key,
        String(
          Array.isArray(raw[key]) ? (raw[key]?.[0] ?? "") : (raw[key] ?? ""),
        ).slice(0, 160),
      ],
    ),
  );
  const classicId = formationId.safeParse(params.classique).success
    ? params.classique!
    : "";
  const apprenticeId = formationId.safeParse(params.apprenti).success
    ? params.apprenti!
    : "";
  const classic = await loadAtlas({
    famille: "parcoursup",
    ...(classicId ? { version: classicId.split(":")[0] } : {}),
    ...(params.campagne ? { campagne: params.campagne } : {}),
  });
  if (classic.status !== "ready")
    return (
      <main id="contenu" className="py-12">
        <h1 className="text-2xl font-semibold">
          La comparaison est temporairement indisponible.
        </h1>
      </main>
    );
  const apprentice = await loadAtlas({
    famille: "apprentissage",
    campagne: String(classic.data.source.campaign),
    ...(apprenticeId ? { version: apprenticeId.split(":")[0] } : {}),
  });
  if (
    apprentice.status !== "ready" ||
    apprentice.data.source.campaign !== classic.data.source.campaign
  )
    return (
      <main id="contenu" className="py-12">
        <h1 className="text-2xl font-semibold">
          Aucune campagne commune publiée pour ces deux modalités.
        </h1>
      </main>
    );
  const choice = (data: AtlasData, id: string, q: string): ModalityChoice => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const matches = data.items.filter((row) =>
      terms.every((term) =>
        fold(
          `${row.title} ${row.establishment ?? ""} ${row.city ?? ""}`,
        ).includes(term),
      ),
    );
    return {
      source: data.source,
      selected: data.items.find((row) => row.id === id) ?? null,
      candidates: matches.slice(0, 8),
      total: matches.length,
      q,
    };
  };
  return (
    <ModalityComparison
      classic={choice(classic.data, classicId, params.q_classique ?? "")}
      apprentice={choice(
        apprentice.data,
        apprenticeId,
        params.q_apprenti ?? "",
      )}
      params={{
        ...params,
        classique: classicId,
        apprenti: apprenticeId,
        campagne: String(classic.data.source.campaign),
      }}
    />
  );
}
