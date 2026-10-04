import type { Metadata } from "next";
import type { SearchParams } from "@/features/formations/domain/explorer";
import { loadAtlas } from "@/features/atlas/server/load";
import { sourceQuiz } from "@/features/discovery/domain/quiz";
import { Quiz } from "@/features/discovery/ui/quiz";
import { DataUnavailable } from "@/features/observatory/ui/shared";

export const metadata: Metadata = { title: "À votre avis ?" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const result = await loadAtlas({
    campagne: params.campagne,
    version: params.version,
    famille: "parcoursup",
  });
  if (result.status !== "ready")
    return (
      <DataUnavailable
        title="À votre avis ?"
        status={result.status === "empty" ? "empty" : "unavailable"}
      />
    );
  return (
    <Quiz
      key={`${result.data.source.releaseId}:${result.data.source.campaign}`}
      questions={sourceQuiz(result.data)}
      source={result.data.source}
    />
  );
}
