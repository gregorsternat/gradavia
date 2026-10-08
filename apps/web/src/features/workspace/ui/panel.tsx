"use client";
import {
  cloneElement,
  createElement,
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
} from "react";
import type { PanelPayload } from "../server/load";
import type { PanelId } from "../domain/registry";
import { presentation } from "../domain/presentation";
import { viewLoaders, type ViewId } from "./views";

type ViewComponent = ComponentType<Record<string, unknown>>;
export function Panel({
  panel,
  payload,
  params,
  initialContent,
  initialView,
}: {
  panel: PanelId;
  payload: PanelPayload;
  params: URLSearchParams;
  initialContent?: ReactElement;
  initialView?: ViewId | "message";
}) {
  const descriptor = presentation(panel, payload, params);
  const view = descriptor.view;
  const [loaded, setLoaded] = useState<{
    view: ViewId;
    component: ViewComponent;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (view === "message" || view === initialView || loaded?.view === view)
      return;
    let cancelled = false;
    void viewLoaders[view]()
      .then((component) => {
        if (!cancelled)
          setLoaded({ view, component: component as ViewComponent });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [view, initialView, loaded?.view, attempt]);
  if (descriptor.view === "message")
    return <p className="py-12">{descriptor.message}</p>;
  if (view === initialView && initialContent)
    return cloneElement(initialContent, {
      ...descriptor.props,
      key: descriptor.key,
    });
  if (loaded?.view === view)
    return createElement(loaded.component, {
      ...descriptor.props,
      key: descriptor.key,
    });
  return failed ? (
    <div role="alert">
      <p>L’outil n’a pas pu être chargé.</p>
      <button
        onClick={() => {
          setFailed(false);
          setAttempt((value) => value + 1);
        }}
      >
        Réessayer
      </button>
    </div>
  ) : (
    <p aria-live="polite" className="py-8">
      Chargement de l’outil…
    </p>
  );
}
