"use client";
// beui.dev/components/motion/radio

import { motion, MotionConfig } from "motion/react";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

type RadioCtx = {
  value: string;
  setValue: (value: string) => void;
  layoutId: string;
};

const RadioCtx = createContext<RadioCtx | null>(null);

function useRadioGroup() {
  const ctx = useContext(RadioCtx);
  if (!ctx) {
    throw new Error("RadioGroupItem must be used inside <RadioGroup>");
  }
  return ctx;
}

export interface RadioGroupProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
  orientation?: "vertical" | "horizontal";
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

export function RadioGroup({
  value,
  defaultValue = "",
  onValueChange,
  children,
  className,
  orientation = "vertical",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: RadioGroupProps) {
  const [internal, setInternal] = useState(defaultValue);
  const layoutId = useId();
  const reduce = useReducedMotion();
  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const setValue = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );
  const contextValue = useMemo(
    () => ({ value: current, setValue, layoutId }),
    [current, layoutId, setValue],
  );

  return (
    <MotionConfig transition={reduce ? { duration: 0 } : SPRING_LAYOUT}>
      <RadioCtx.Provider value={contextValue}>
        <div
          role="radiogroup"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-orientation={orientation}
          tabIndex={current ? undefined : 0}
          onFocus={(event) => {
            if (event.target === event.currentTarget) {
              event.currentTarget
                .querySelector<HTMLButtonElement>(
                  '[role="radio"]:not(:disabled)',
                )
                ?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (
              ![
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
              ].includes(event.key)
            )
              return;
            const options = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]:not(:disabled)',
              ),
            );
            if (!options.length) return;
            event.preventDefault();
            const index = options.indexOf(event.target as HTMLButtonElement);
            const nextIndex =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : (index +
                      (event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? -1
                        : 1) +
                      options.length) %
                    options.length;
            const option = options[nextIndex];
            if (!option) return;
            setValue(option.dataset.value ?? "");
            option.focus();
          }}
          className={cn(
            "flex gap-3",
            orientation === "vertical" ? "flex-col" : "flex-row flex-wrap",
            className,
          )}
        >
          {children}
        </div>
      </RadioCtx.Provider>
    </MotionConfig>
  );
}

export interface RadioGroupItemProps {
  value: string;
  variant?: "indicator" | "segment";
  children?: ReactNode;
  "aria-label"?: string;
  "aria-describedby"?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function RadioGroupItem({
  value,
  variant = "indicator",
  children,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  label,
  disabled,
  className,
  id: idProp,
}: RadioGroupItemProps) {
  const { value: groupValue, setValue, layoutId } = useRadioGroup();
  const autoId = useId();
  const id = idProp ?? autoId;
  const reduce = useReducedMotion();
  const selected = groupValue === value;

  if (variant === "segment") {
    return (
      <motion.button
        id={id}
        type="button"
        role="radio"
        data-value={value}
        data-state={selected ? "checked" : "unchecked"}
        tabIndex={selected ? 0 : -1}
        aria-checked={selected}
        aria-label={ariaLabel ?? label}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => !disabled && setValue(value)}
        whileTap={reduce || disabled ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className={cn(
          "relative isolate inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
          selected
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {selected ? (
          <motion.span
            aria-hidden="true"
            layoutId={layoutId}
            className="absolute inset-0 -z-10 rounded-[inherit] bg-surface shadow-[0_1px_3px_#0000000d]"
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
          />
        ) : null}
        {children ?? label}
      </motion.button>
    );
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-3",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <motion.button
        id={id}
        type="button"
        role="radio"
        data-value={value}
        tabIndex={selected ? 0 : -1}
        aria-checked={selected}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => !disabled && setValue(value)}
        whileTap={reduce || disabled ? undefined : { scale: 0.92 }}
        transition={SPRING_PRESS}
        data-state={selected ? "checked" : "unchecked"}
        className={cn(
          "relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 outline-none transition-colors duration-200",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-60",
          selected
            ? "border-primary"
            : "border-muted-foreground/50 hover:border-muted-foreground",
        )}
      >
        {selected ? (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-1 rounded-full bg-primary"
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
          />
        ) : null}
      </motion.button>
      {label ? (
        <span
          className={cn(
            "select-none text-sm text-foreground",
            disabled && "opacity-60",
          )}
        >
          {label}
        </span>
      ) : null}
    </label>
  );
}
