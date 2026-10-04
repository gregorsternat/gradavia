"use client";

import { ButtonLink } from "@/components/motion/button/base";
import { cn } from "@/lib/utils";

export interface NotFoundProps {
  className?: string;
  /** The big status code. */
  code?: string;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  browseHref?: string;
  browseLabel?: string;
}

export const NOT_FOUND_DEFAULTS = {
  code: "404",
  title: "Cette page n’existe pas.",
  description: "",
  homeHref: "/",
  homeLabel: "Revenir à l’accueil",
  browseHref: "/formations",
  browseLabel: "Explorer les formations",
} as const;

type ActionsProps = Pick<
  NotFoundProps,
  "homeHref" | "homeLabel" | "browseHref" | "browseLabel" | "className"
>;

/** The shared dual CTA: a primary "Back home" and a secondary "Browse". */
export function NotFoundActions({
  homeHref = NOT_FOUND_DEFAULTS.homeHref,
  homeLabel = NOT_FOUND_DEFAULTS.homeLabel,
  browseHref = NOT_FOUND_DEFAULTS.browseHref,
  browseLabel = NOT_FOUND_DEFAULTS.browseLabel,
  className,
}: ActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3",
        className,
      )}
    >
      <ButtonLink href={homeHref} className="rounded-lg">
        {homeLabel}
      </ButtonLink>
      <ButtonLink href={browseHref} variant="secondary" className="rounded-lg">
        {browseLabel}
      </ButtonLink>
    </div>
  );
}

/** Centers a variant and gives it a consistent minimum stage height. */
export function NotFoundStage({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[420px] w-full flex-col items-center justify-center gap-8 px-4 text-center",
        className,
      )}
    >
      {children}
    </div>
  );
}
