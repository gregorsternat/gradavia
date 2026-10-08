import "server-only";
import { createElement, type ComponentType } from "react";
import { presentation } from "../domain/presentation";
import { serverViews } from "./views";
import { panelParams, resolvePanel, searchString } from "../domain/registry";
import { loadPanel } from "./load";
import { Workspace } from "../ui/workspace";
import { workspaceMetadata as metadataForPanel } from "../domain/metadata";
import type { SearchParams } from "@/features/formations/domain/explorer";

export async function workspaceMetadata(path: string, params: SearchParams) {
  const panel = resolvePanel(path, new URLSearchParams(searchString(params)))!;
  const query = panelParams(panel, new URLSearchParams(searchString(params)));
  return metadataForPanel(
    panel,
    query,
    panel === "formations"
      ? await loadPanel(panel, query.toString())
      : undefined,
  );
}
export async function WorkspacePage({
  path,
  params,
}: {
  path: string;
  params: SearchParams;
}) {
  const panel = resolvePanel(path, new URLSearchParams(searchString(params)))!;
  const query = panelParams(panel, new URLSearchParams(searchString(params)));
  const payload = await loadPanel(panel, query.toString());
  const descriptor = presentation(panel, payload, query);
  const initialContent =
    descriptor.view === "message" ? (
      <p className="py-12">{descriptor.message}</p>
    ) : (
      createElement(
        serverViews[descriptor.view] as ComponentType<Record<string, unknown>>,
        { ...descriptor.props, key: descriptor.key },
      )
    );
  return (
    <Workspace
      key={path}
      initialPanel={panel}
      initialSearch={query.toString()}
      initialPayload={payload}
      initialView={descriptor.view}
      initialContent={initialContent}
    />
  );
}
