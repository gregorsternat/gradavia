"use client";

import { motion, type Transition } from "motion/react";
import {
  type CSSProperties,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { usePopoverPortalPosition } from "@/components/motion/popover-position";
import { cn } from "@/lib/utils";
import { useClientReady } from "@/lib/hooks/use-client-ready";
import { useComboboxContext } from "./context";

type Side = "top" | "bottom";
type Align = "start" | "center" | "end";

// The panel uses one weighted spring for both directions, so opening and
// closing travel through the same detached geometry.
const COMBOBOX_MORPH: Transition = {
  type: "spring",
  duration: 0.5,
  bounce: 0.22,
};
const VIEWPORT_PADDING = 8;

export interface ComboboxContentProps {
  children: ReactNode;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  avoidCollisions?: boolean;
  className?: string;
}

export function ComboboxContent({
  children,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  avoidCollisions = true,
  className,
}: ComboboxContentProps) {
  const { triggerRef, contentRef, open, reduce } =
    useComboboxContext("ComboboxContent");
  const measureRef = useRef<HTMLDivElement>(null);
  const portalReady = useClientReady();
  const [actualSide, setActualSide] = useState<Side>(side);
  const [morphReady, setMorphReady] = useState(false);
  const layout = usePopoverPortalPosition(triggerRef, measureRef, portalReady);

  useLayoutEffect(() => {
    if (!portalReady) return;
    const readyFrame = requestAnimationFrame(() => setMorphReady(true));
    return () => cancelAnimationFrame(readyFrame);
  }, [portalReady]);

  // Derive placement from the committed geometry snapshot; retain it on exit.
  if (open && layout) {
    const below =
      window.innerHeight - (layout.trigger.top + layout.trigger.height);
    const above = layout.trigger.top;
    const resolvedSide = !avoidCollisions
      ? side
      : side === "bottom" &&
          below < layout.content.height + sideOffset &&
          above > below
        ? "top"
        : side === "top" &&
            above < layout.content.height + sideOffset &&
            below > above
          ? "bottom"
          : side;
    if (actualSide !== resolvedSide) setActualSide(resolvedSide);
  }

  if (!portalReady) return null;

  const triggerLeft = layout?.trigger.left ?? 0;
  const triggerWidth = layout?.trigger.width ?? 0;
  const contentWidth = layout?.content.width ?? triggerWidth;
  const desiredLeft =
    align === "end"
      ? triggerLeft + triggerWidth - contentWidth
      : align === "center"
        ? triggerLeft + (triggerWidth - contentWidth) / 2
        : triggerLeft;
  const maxLeft = Math.max(
    VIEWPORT_PADDING,
    window.innerWidth - contentWidth - VIEWPORT_PADDING,
  );
  const left = Math.min(Math.max(desiredLeft, VIEWPORT_PADDING), maxLeft);
  const surfaceHeight = layout?.content.height ?? 0;

  return createPortal(
    <motion.div
      ref={contentRef}
      data-combobox-content=""
      data-side={actualSide}
      aria-hidden={!open}
      inert={!open}
      initial={false}
      animate={{
        height: open ? surfaceHeight : 0,
        opacity: open ? 1 : 0,
        y: open ? (actualSide === "bottom" ? sideOffset : -sideOffset) : 0,
      }}
      transition={reduce || !morphReady ? { duration: 0 } : COMBOBOX_MORPH}
      style={
        {
          left,
          top:
            actualSide === "bottom" && layout
              ? layout.trigger.top + layout.trigger.height
              : undefined,
          bottom:
            actualSide === "top" && layout
              ? window.innerHeight - layout.trigger.top
              : undefined,
          minWidth: triggerWidth,
          pointerEvents: open ? "auto" : "none",
          transformOrigin: actualSide === "bottom" ? "top" : "bottom",
          visibility: layout ? "visible" : "hidden",
          "--combobox-trigger-width": `${triggerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        "fixed z-[9999] w-(--combobox-trigger-width) overflow-hidden rounded-xl border border-border bg-background text-popover-foreground outline-none will-change-[height,transform]",
        className,
      )}
    >
      <motion.div
        ref={measureRef}
        initial={false}
        animate={{ opacity: open ? 1 : 0 }}
        transition={reduce || !morphReady ? { duration: 0 } : COMBOBOX_MORPH}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
