import {
  pageMetadata,
  explorerMetadata,
  type PublicPage,
} from "../../seo/domain/metadata";
import {
  panelParams,
  panelHref,
  panels,
  paramRecord,
  type PanelId,
} from "./registry";
import type { PanelPayload } from "../server/load";

export function workspaceMetadata(
  panel: PanelId,
  input: URLSearchParams,
  payload?: PanelPayload,
) {
  if (panel === "formations" && payload?.kind === "formations")
    return explorerMetadata(payload.result);
  const query = panelParams(panel, input);
  if (
    panel.startsWith("apprentissage") ||
    panel === "archives" ||
    panel === "carte"
  )
    query.delete("famille");
  const metadata = pageMetadata(
    panels[panel].path as PublicPage,
    paramRecord(query),
  );
  const canonical = new URL(String(metadata.alternates!.canonical));
  const href = new URL(
    panelHref(panel, canonical.searchParams),
    canonical.origin,
  ).href;
  return {
    ...metadata,
    alternates: { canonical: href },
    openGraph: { ...metadata.openGraph, url: href },
  };
}
