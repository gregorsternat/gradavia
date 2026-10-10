"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  panels,
  spaces,
  resolvePanel,
  panelHref,
  panelParams,
  canonicalHref,
  resourceKey,
  representationParams,
  type PanelId,
} from "../domain/registry";
import type { PanelPayload } from "../server/load";
import { PanelNavigationProvider } from "./navigation";
import { Panel } from "./panel";
import type { ViewId } from "./views";
import { workspaceMetadata } from "../domain/metadata";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/motion/tabs";
import { MotionActivityProvider } from "@/lib/hooks/use-reduced-motion";
import { SelectField } from "@/features/formations/ui/shared";

type Entry = {
  search: string;
  hash: string;
  scroll: number;
  loadedKey?: string;
  loadedSearch?: string;
  payload?: PanelPayload;
  failed?: boolean;
};
type State = { active: PanelId; entries: Partial<Record<PanelId, Entry>> };
function failed(payload: PanelPayload) {
  return "results" in payload
    ? (payload.results?.some(({ result }) => result.status === "unavailable") ??
        false)
    : "result" in payload && payload.result?.status === "unavailable";
}
function PanelBoundary({
  id,
  entry,
  active,
  navigate,
  retry,
  initialView,
}: {
  id: PanelId;
  entry: Entry;
  active: boolean;
  navigate: (href: string, replace?: boolean) => void;
  retry: (id: PanelId) => void;
  initialView?: ViewId | "message";
}) {
  const waiting =
    resourceKey(id, new URLSearchParams(entry.search)) !== entry.loadedKey;
  const params = useMemo(
    () => new URLSearchParams(entry.search),
    [entry.search],
  );
  const refresh = useCallback(() => retry(id), [id, retry]);
  const context = useMemo(
    () => ({
      panel: id,
      params,
      active,
      pending: waiting && !entry.failed,
      hash: entry.hash,
      navigate,
      refresh,
    }),
    [id, params, active, waiting, entry.failed, entry.hash, navigate, refresh],
  );
  return (
    <PanelNavigationProvider value={context}>
      <MotionActivityProvider value={active}>
        <div inert={!active} aria-busy={waiting && !entry.failed}>
          {waiting && !entry.failed && (
            <p
              aria-live="polite"
              className="py-4 text-sm text-muted-foreground"
            >
              Chargement de {panels[id].label.toLocaleLowerCase("fr")}…
            </p>
          )}
          {entry.failed && (
            <div role="alert" className="panel my-4 p-4">
              <p>Les données sont temporairement indisponibles.</p>
              <button
                type="button"
                className="mt-2 underline"
                onClick={refresh}
              >
                Réessayer
              </button>
            </div>
          )}
          {entry.payload && (
            <Panel
              initialView={initialView}
              panel={id}
              payload={entry.payload}
              params={
                waiting && id === "favoris"
                  ? new URLSearchParams(entry.loadedSearch)
                  : params
              }
            />
          )}
        </div>
      </MotionActivityProvider>
    </PanelNavigationProvider>
  );
}
function cachePayload(
  cache: Map<string, PanelPayload>,
  id: PanelId,
  search: string,
  payload: PanelPayload,
) {
  if (failed(payload)) return;
  cache.set(resourceKey(id, new URLSearchParams(search)), payload);
  if (
    (payload.kind === "atlas" || payload.kind === "formations") &&
    payload.result.status === "ready"
  ) {
    const query = new URLSearchParams(search);
    if (payload.kind === "atlas")
      query.set("famille", payload.result.data.family);
    query.set("campagne", String(payload.result.data.source.campaign));
    query.set("version", payload.result.data.source.releaseId);
    cache.set(resourceKey(id, query), payload);
  }
  while (cache.size > 24) cache.delete(cache.keys().next().value!);
}
export function Workspace({
  initialPanel,
  initialSearch,
  initialPayload,
  initialView,
}: {
  initialPanel: PanelId;
  initialSearch: string;
  initialPayload: PanelPayload;
  initialView: ViewId | "message";
}) {
  const space = spaces[panels[initialPanel].space];
  const router = useRouter();
  const search = useSearchParams();
  const [state, setState] = useState<State>(() => ({
    active: initialPanel,
    entries: {
      [initialPanel]: {
        search: initialSearch,
        hash: "",
        scroll: 0,
        payload: initialPayload,
        loadedSearch: initialSearch,
        loadedKey: resourceKey(
          initialPanel,
          new URLSearchParams(initialSearch),
        ),
        failed: failed(initialPayload),
      },
    },
  }));
  const latest = useRef(state);
  const cache = useRef(new Map<string, PanelPayload>());
  const requests = useRef(new Map<string, Promise<PanelPayload>>());
  const historySearch = search.toString();
  const observed = useRef("");
  useEffect(() => {
    latest.current = state;
  }, [state]);
  useEffect(() => {
    cachePayload(cache.current, initialPanel, initialSearch, initialPayload);
  }, [initialPanel, initialSearch, initialPayload]);

  // Keep panel routers stable: feature effects depend on router identity while
  // reconciling saved selections with their loaded URL parameters.
  const retry = useCallback((id: PanelId) => {
    const entry = latest.current.entries[id];
    if (!entry || latest.current.active !== id) return;
    cache.current.delete(resourceKey(id, new URLSearchParams(entry.search)));
    setState((current) => ({
      ...current,
      entries: {
        ...current.entries,
        [id]: {
          ...current.entries[id]!,
          loadedKey: undefined,
          failed: false,
        },
      },
    }));
  }, []);

  const activate = useCallback(
    (href: string, replace = false, fromHistory = false) => {
      const url = new URL(canonicalHref(href), window.location.href);
      const target = resolvePanel(url.pathname, url.searchParams);
      if (
        url.origin !== window.location.origin ||
        !target ||
        panels[target].space !== panels[initialPanel].space
      ) {
        if (replace) router.replace(url.pathname + url.search + url.hash);
        else router.push(url.pathname + url.search + url.hash);
        return;
      }
      const nextSearch = panelParams(target, url.searchParams).toString();
      const canonical = panelHref(
        target,
        new URLSearchParams(nextSearch),
        url.hash,
      );
      observed.current = canonical;
      if (!fromHistory) {
        if (replace) window.history.replaceState(null, "", canonical);
        else if (
          canonical !==
          window.location.pathname +
            window.location.search +
            window.location.hash
        )
          window.history.pushState(null, "", canonical);
      }
      const previous = latest.current;
      const old = previous.entries[previous.active];
      const remembered = previous.entries[target];
      const forceRetry =
        target === previous.active && remembered?.failed && !fromHistory;
      const key = resourceKey(target, new URLSearchParams(nextSearch));
      const cached = cache.current.get(key);
      const entry: Entry = {
        scroll: 0,
        ...remembered,
        search: nextSearch,
        hash: url.hash,
        ...(forceRetry ? { loadedKey: undefined } : {}),
        failed:
          !forceRetry &&
          remembered &&
          resourceKey(target, new URLSearchParams(remembered.search)) === key
            ? remembered.failed
            : false,
        ...(cached
          ? {
              payload: cached,
              loadedKey: key,
              loadedSearch: nextSearch,
              failed: false,
            }
          : {}),
      };
      const next = {
        active: target,
        entries: {
          ...previous.entries,
          ...(old
            ? { [previous.active]: { ...old, scroll: window.scrollY } }
            : {}),
          [target]: entry,
        },
      };
      latest.current = next;
      setState(next);
      if (target !== previous.active)
        requestAnimationFrame(() => {
          window.scrollTo({ top: entry.scroll, behavior: "instant" });
          window.dispatchEvent(new Event("resize"));
        });
      if (url.hash && !url.hash.startsWith("#liste="))
        requestAnimationFrame(() =>
          document
            .getElementById(decodeURIComponent(url.hash.slice(1)))
            ?.scrollIntoView(),
        );
    },
    [initialPanel, router],
  );

  // Native history, browser back/forward and Next links all converge here.
  useEffect(() => {
    const sync = () => {
      const current =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      if (current !== observed.current) activate(current, true, true);
    };
    sync();
    const navigate = (event: Event) => {
      const request = (event as CustomEvent<{ href: string; handled: boolean }>)
        .detail;
      request.handled = true;
      activate(request.href);
    };
    window.addEventListener("gradavia-workspace-navigate", navigate);
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("gradavia-workspace-navigate", navigate);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, [historySearch, activate]);

  const entry = state.entries[state.active]!;
  const wantedKey = resourceKey(
    state.active,
    new URLSearchParams(entry.search),
  );
  useEffect(() => {
    const metadata = workspaceMetadata(
      state.active,
      new URLSearchParams(entry.search),
      entry.payload,
    );
    const title = `${String(metadata.title)} · Gradavia`;
    document.title = title;
    const values: Record<string, string> = {
      description: String(metadata.description ?? ""),
      "og:title": title,
      "twitter:title": title,
      "og:description": String(metadata.description ?? ""),
      "twitter:description": String(metadata.description ?? ""),
      "og:url": String(metadata.alternates?.canonical ?? ""),
      robots:
        typeof metadata.robots === "object" &&
        metadata.robots !== null &&
        metadata.robots.index === false
          ? "noindex, follow"
          : "index, follow",
    };
    for (const [key, value] of Object.entries(values)) {
      const element = document.head.querySelector<HTMLMetaElement>(
        `meta[${key.startsWith("og:") ? "property" : "name"}="${key}"]`,
      );
      if (element) element.content = value;
    }
    const canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (canonical)
      canonical.href = String(metadata.alternates?.canonical ?? "");
  }, [state.active, entry.search, entry.payload]);
  useEffect(() => {
    if (entry.loadedKey === wantedKey || entry.failed) return;
    const id = state.active;
    let request = requests.current.get(wantedKey);
    if (!request) {
      request = fetch(`/api/workspace/${id}?${entry.search}`).then(
        async (response) => {
          if (!response.ok) throw new Error("Panel unavailable");
          return (await response.json()) as PanelPayload;
        },
      );
      requests.current.set(wantedKey, request);
      void request
        .finally(() => requests.current.delete(wantedKey))
        .catch(() => {});
    }
    let cancelled = false;
    void request
      .then((payload) => {
        cachePayload(cache.current, id, entry.search, payload);
        if (cancelled) return;
        setState((current) => {
          const existing = current.entries[id];
          if (
            !existing ||
            resourceKey(id, new URLSearchParams(existing.search)) !== wantedKey
          )
            return current;
          return {
            ...current,
            entries: {
              ...current.entries,
              [id]: {
                ...existing,
                payload,
                loadedKey: wantedKey,
                loadedSearch: existing.search,
                failed: failed(payload),
              },
            },
          };
        });
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      })
      .catch(() => {
        if (!cancelled)
          setState((current) => {
            const existing = current.entries[id];
            if (
              !existing ||
              resourceKey(id, new URLSearchParams(existing.search)) !==
                wantedKey
            )
              return current;
            return {
              ...current,
              entries: {
                ...current.entries,
                [id]: { ...existing, failed: true },
              },
            };
          });
      });
    return () => {
      cancelled = true;
    };
  }, [state.active, entry.search, entry.loadedKey, entry.failed, wantedKey]);

  const targetHref = (id: PanelId) => {
    if (id === state.active)
      return panelHref(id, new URLSearchParams(entry.search), entry.hash);
    const remembered = state.entries[id];
    let params = new URLSearchParams(remembered?.search);
    if (space.path === "/formations") {
      const current = new URLSearchParams(entry.search);
      // Only resolve implicit defaults from data matching the requested context.
      // A pending read still displays the previous payload while its URL changes.
      if (
        (entry.payload?.kind === "atlas" ||
          entry.payload?.kind === "formations") &&
        entry.payload.result.status === "ready" &&
        entry.loadedKey === resourceKey(state.active, current)
      ) {
        if (!current.has("campagne"))
          current.set(
            "campagne",
            String(entry.payload.result.data.source.campaign),
          );
        if (state.active.startsWith("apprentissage") && !current.has("version"))
          current.set("version", entry.payload.result.data.source.releaseId);
      }
      if (
        (remembered?.payload?.kind === "atlas" ||
          remembered?.payload?.kind === "formations") &&
        remembered.payload.result.status === "ready" &&
        remembered.loadedKey === resourceKey(id, params) &&
        !params.has("campagne")
      )
        params.set(
          "campagne",
          String(remembered.payload.result.data.source.campaign),
        );
      params = representationParams(
        state.active,
        id,
        current,
        remembered ? params : undefined,
      );
    }
    if (
      ["overview", "territoires"].includes(id) &&
      ["overview", "territoires"].includes(state.active)
    ) {
      const campaign = new URLSearchParams(entry.search).get("campagne");
      if (campaign) params.set("campagne", campaign);
      else params.delete("campagne");
    }
    return panelHref(id, params, remembered?.hash);
  };
  const otherSearch = new URLSearchParams(
    state.entries[state.active === "formations" ? "carte" : "formations"]
      ?.search,
  );
  const retainedCriteria =
    state.active === "carte"
      ? [
          otherSearch.get("departement")
            ? `Département : ${otherSearch.get("departement")}`
            : "",
          otherSearch.get("selectivite")
            ? `Sélectivité : ${otherSearch.get("selectivite")}`
            : "",
        ].filter(Boolean)
      : state.active === "formations"
        ? [
            otherSearch.get("ville")
              ? `Proximité : ${otherSearch.get("ville")}`
              : "",
            otherSearch.get("interet") ? "Centre d’intérêt" : "",
            [
              "places_min",
              "places_max",
              "acces_min",
              "acces_max",
              "voeux_min",
              "voeux_max",
            ].some((key) => otherSearch.has(key))
              ? "Seuils d’indicateurs"
              : "",
            otherSearch.get("similaire") ? "Formation de référence" : "",
            ["distance", "priorities"].includes(otherSearch.get("tri") ?? "")
              ? "Tri propre à la carte"
              : "",
          ].filter(Boolean)
        : [];
  const ids: readonly PanelId[] =
    space.path === "/formations" && state.active.startsWith("apprentissage")
      ? ["apprentissage", "apprentissage-carte"]
      : space.panels;
  return (
    <main
      id="contenu"
      tabIndex={-1}
      data-workspace={space.path}
      onClickCapture={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        const anchor = (event.target as Element).closest<HTMLAnchorElement>(
          "a[href]",
        );
        if (
          !anchor ||
          anchor.target === "_blank" ||
          anchor.hasAttribute("download") ||
          anchor.getAttribute("role") === "tab"
        )
          return;
        const url = new URL(anchor.href);
        const id = resolvePanel(url.pathname, url.searchParams);
        if (
          url.origin !== window.location.origin ||
          !id ||
          panels[id].space !== panels[initialPanel].space
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        activate(url.pathname + url.search + url.hash);
      }}
      onSubmitCapture={(event) => {
        const form = event.target as HTMLFormElement;
        if (!form.hasAttribute("action") || form.method.toLowerCase() !== "get")
          return;
        const url = new URL(form.action);
        if (url.origin !== window.location.origin) return;
        url.search = new URLSearchParams(
          [...new FormData(form)].filter(
            (item): item is [string, string] => typeof item[1] === "string",
          ),
        ).toString();
        const id = resolvePanel(url.pathname, url.searchParams);
        if (!id || panels[id].space !== panels[initialPanel].space) return;
        event.preventDefault();
        activate(url.pathname + url.search);
      }}
    >
      {space.path === "/formations" && (
        <div className="pt-6">
          <SelectField
            label="Périmètre des formations"
            value={
              state.active.startsWith("apprentissage")
                ? "apprentissage"
                : "parcoursup"
            }
            options={[
              { value: "parcoursup", label: "Hors apprentissage" },
              { value: "apprentissage", label: "Apprentissage" },
            ]}
            onChange={(family) => {
              const params = new URLSearchParams();
              const q = new URLSearchParams(entry.search).get("q");
              if (q) params.set("q", q);
              const map = panels[state.active].tab === "carte";
              const id =
                family === "apprentissage"
                  ? map
                    ? "apprentissage-carte"
                    : "apprentissage"
                  : map
                    ? "carte"
                    : "formations";
              activate(panelHref(id, params));
            }}
            className="w-full sm:w-56"
          />
        </div>
      )}
      <Tabs
        value={state.active}
        onValueChange={(value) => activate(targetHref(value as PanelId))}
        activationMode="manual"
        variant={space.path === "/formations" ? "segment" : "underline"}
        className="pt-5"
      >
        <TabsList aria-label={`Dans ${space.label}`}>
          {ids.map((id) => (
            <TabsTrigger key={id} value={id} href={targetHref(id)}>
              {panels[id].label}
            </TabsTrigger>
          ))}
        </TabsList>
        {space.path === "/formations" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Les critères communs suivent le changement de vue. Les critères
            propres à chaque vue sont conservés et restent inactifs dans l’autre
            vue. La liste hors apprentissage utilise la dernière publication ;
            une version archivée de la carte reste propre à la carte.
          </p>
        )}
        {retainedCriteria.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Conservés dans l’autre vue, inactifs ici :{" "}
            {retainedCriteria.join(" · ")}.
          </p>
        )}
        {(
          [...new Set([...ids, ...Object.keys(state.entries)])] as PanelId[]
        ).map((id) => (
          <TabsContent key={id} value={id} className="mt-0">
            {state.entries[id] && (
              <PanelBoundary
                id={id}
                initialView={id === initialPanel ? initialView : undefined}
                entry={state.entries[id]!}
                active={state.active === id}
                navigate={activate}
                retry={retry}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
