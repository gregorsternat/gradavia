import LoadingFormations from "@/features/formations/ui/loading";
import ObservatoryLoading from "@/features/observatory/ui/loading";
import { spaces } from "../domain/registry";

export function WorkspaceLoading({ path }: { path: string }) {
  const space = spaces.find((space) => space.path === path)!;
  return (
    <div data-workspace-loading>
      {path === "/formations" ? (
        <LoadingFormations />
      ) : (
        <ObservatoryLoading label={`Chargement · ${space.label}`} />
      )}
    </div>
  );
}

export function WorkspaceNoScript() {
  // Streamed boundaries arrive in hidden body-level containers. Without JS,
  // expose the workspace and its lazy view in source order, keeping tabs hidden.
  // Match our semantic marker instead of React's generated segment identifiers.
  return (
    <noscript>
      <style>{`
    @layer base {
      body > [hidden]:has(> main[data-workspace], > [data-workspace-view]) { display: block !important; }
    }
    .page-frame:has([data-workspace-loading]) { display: none; }
    [data-slot="sidebar-wrapper"]:has([data-workspace-loading]) { min-height: 0; }
    body > [hidden]:has(> main[data-workspace], > [data-workspace-view]) {
      max-width: 1480px;
      margin-inline: auto;
      padding-inline: 1rem;
    }
    body > [hidden]:has(> [data-workspace-view]) { padding-bottom: 3.5rem; }
    @media (min-width: 640px) {
      body > [hidden]:has(> main[data-workspace], > [data-workspace-view]) { padding-inline: 2rem; }
    }
    @media (min-width: 768px) {
      [data-slot="sidebar-wrapper"]:has([data-workspace-loading]) [data-slot="sidebar"] {
        position: fixed; inset: 0 auto 0 0;
      }
      [data-slot="sidebar-wrapper"]:has([data-workspace-loading]) .app-topbar { margin-left: 224px; }
      body > [hidden]:has(> main[data-workspace], > [data-workspace-view]) {
        width: calc(100% - 224px);
        margin-left: max(224px, calc((100% + 224px - 1480px) / 2));
      }
    }
    @media (min-width: 1024px) {
      body > [hidden]:has(> main[data-workspace], > [data-workspace-view]) { padding-inline: 2.5rem; }
    }
  `}</style>
    </noscript>
  );
}
