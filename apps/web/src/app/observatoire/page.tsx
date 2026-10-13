import { Suspense } from "react";
import {
  WorkspaceLoading,
  WorkspaceNoScript,
} from "@/features/workspace/ui/loading";
import type { SearchParams } from "@/features/formations/domain/explorer";
import {
  WorkspacePage,
  workspaceMetadata,
} from "@/features/workspace/server/page";

type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
  return workspaceMetadata("/observatoire", await searchParams);
}
export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <>
      <WorkspaceNoScript />
      <Suspense fallback={<WorkspaceLoading path="/observatoire" />}>
        <WorkspacePage path="/observatoire" params={params} />
      </Suspense>
    </>
  );
}
