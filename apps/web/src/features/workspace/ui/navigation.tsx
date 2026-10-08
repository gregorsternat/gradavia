"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  useRouter as useNextRouter,
  useSearchParams as useNextSearchParams,
  usePathname as useNextPathname,
} from "next/navigation";
import NextLink from "next/link";
import type { ComponentProps, ComponentPropsWithoutRef } from "react";
import {
  canonicalHref,
  resolvePanel,
  panels,
  type PanelId,
} from "../domain/registry";

export type PanelNavigation = {
  panel: PanelId;
  params: URLSearchParams;
  active: boolean;
  pending: boolean;
  hash: string;
  navigate: (href: string, replace?: boolean) => void;
  refresh: () => void;
};
const Context = createContext<PanelNavigation | null>(null);
export const PanelNavigationProvider = Context.Provider;
export function usePanelPending() {
  return useContext(Context)?.pending ?? false;
}
export function usePanelActive() {
  return useContext(Context)?.active ?? true;
}
export function usePanelHash() {
  return useContext(Context)?.hash;
}
export function useSearchParams() {
  const context = useContext(Context);
  const search = useNextSearchParams();
  return context?.params ?? search;
}
export function usePathname() {
  const context = useContext(Context);
  const path = useNextPathname();
  return context ? panels[context.panel].path : path;
}
export function useRouter() {
  const context = useContext(Context);
  const router = useNextRouter();
  return useMemo(
    () => ({
      ...router,
      refresh: () => {
        if (context) {
          if (context.active) context.refresh();
        } else router.refresh();
      },
      push: (href: string, options?: { scroll?: boolean }) => {
        if (context) {
          if (context.active) context.navigate(href);
        } else router.push(canonicalHref(href), options);
      },
      replace: (href: string, options?: { scroll?: boolean }) => {
        if (context) {
          if (context.active) context.navigate(href, true);
        } else router.replace(canonicalHref(href), options);
      },
      replaceState: (
        _data: unknown,
        _unused: string,
        href?: string | URL | null,
      ) => {
        if (href == null) return;
        if (context) {
          if (context.active) context.navigate(String(href), true);
        } else
          window.history.replaceState(null, "", canonicalHref(String(href)));
      },
    }),
    [context, router],
  );
}
/** Native destinations remain usable without hydration and in a new tab. */
export default function WorkspaceLink({
  href,
  onClick,
  ...props
}: ComponentProps<typeof NextLink>) {
  const context = useContext(Context);
  const target = typeof href === "string" ? canonicalHref(href) : href;
  return (
    <NextLink
      {...props}
      prefetch={props.prefetch ?? (context ? false : undefined)}
      href={target}
      onClick={(event) => {
        onClick?.(event);
        if (
          !context ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === "_blank" ||
          props.download ||
          typeof target !== "string" ||
          !target.startsWith("/")
        )
          return;
        event.preventDefault();
        if (context.active) context.navigate(target);
      }}
    />
  );
}
/** Workspace panels share one main landmark; standalone feature previews keep theirs. */
export function PanelMain({
  children,
  ...props
}: ComponentPropsWithoutRef<"main"> & { children?: ReactNode }) {
  const context = useContext(Context);
  if (!context) return <main {...props}>{children}</main>;
  return (
    <div {...props} id={props.id ? `${context.panel}-${props.id}` : undefined}>
      {children}
    </div>
  );
}

/** Let the mounted workspace handle same-space sidebar and palette links. */
export function navigateInWorkspace(href: string): boolean {
  const url = new URL(canonicalHref(href), window.location.href);
  const current = resolvePanel(
    window.location.pathname,
    new URLSearchParams(window.location.search),
  );
  const target = resolvePanel(url.pathname, url.searchParams);
  if (
    url.origin !== window.location.origin ||
    !current ||
    !target ||
    panels[current].space !== panels[target].space
  )
    return false;
  const detail = { href: url.pathname + url.search + url.hash, handled: false };
  window.dispatchEvent(
    new CustomEvent("gradavia-workspace-navigate", { detail }),
  );
  return detail.handled;
}
