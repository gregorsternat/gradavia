import type { SearchParams } from "@/features/formations/domain/explorer";
import {
  WorkspacePage,
  workspaceMetadata,
} from "@/features/workspace/server/page";

type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
  return workspaceMetadata("/comparer", await searchParams);
}
export default async function Page({ searchParams }: Props) {
  return <WorkspacePage path="/comparer" params={await searchParams} />;
}
