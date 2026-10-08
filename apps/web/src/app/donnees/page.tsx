import { permanentRedirect } from "next/navigation";
import type { SearchParams } from "@/features/formations/domain/explorer";
import {
  canonicalHref,
  searchString,
} from "@/features/workspace/domain/registry";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = searchString(await searchParams);
  permanentRedirect(canonicalHref(`/donnees${query ? `?${query}` : ""}`));
}
