"use client";
// beui.dev/components/blocks/not-found

import { Magnetic } from "@/components/motion/magnetic";
import { cn } from "@/lib/utils";
import {
  NOT_FOUND_DEFAULTS,
  NotFoundActions,
  NotFoundStage,
  type NotFoundProps,
} from "./shared";

export function NotFoundMagnetic({
  className,
  code = NOT_FOUND_DEFAULTS.code,
  title = NOT_FOUND_DEFAULTS.title,
  description = NOT_FOUND_DEFAULTS.description,
  homeHref,
  homeLabel,
  browseHref,
  browseLabel,
}: NotFoundProps) {
  const chars = code.split("");

  return (
    <NotFoundStage className={className}>
      <div
        aria-hidden="true"
        className="flex select-none items-center justify-center font-medium leading-none tracking-[-.08em] text-foreground/30 [font-size:clamp(5rem,18vw,10rem)]"
      >
        {chars.map((ch, i) => (
          <Magnetic
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positional glyphs
            key={i}
            strength={0.12}
            className={cn(i > 0 && "-ml-2")}
          >
            <span aria-hidden className="inline-block px-1 tabular-nums">
              {ch}
            </span>
          </Magnetic>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      <NotFoundActions
        homeHref={homeHref}
        homeLabel={homeLabel}
        browseHref={browseHref}
        browseLabel={browseLabel}
      />
    </NotFoundStage>
  );
}
