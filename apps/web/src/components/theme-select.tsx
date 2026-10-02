"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const modes = [
  { value: "system", label: "Système", Icon: Monitor },
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
] as const;

export function ThemeSelect() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className="flex gap-0.5 rounded-full border border-border bg-surface p-1">
      <legend className="sr-only">Apparence</legend>
      {modes.map(({ value, label, Icon }) => (
        <label key={value} className="relative cursor-pointer">
          <input
            type="radio"
            name="theme"
            value={value}
            aria-label={label}
            checked={mounted && theme === value}
            onChange={() => setTheme(value)}
            className="peer absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span
            className="pointer-events-none flex size-8 items-center justify-center rounded-full text-muted-foreground peer-checked:bg-subtle peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground"
            title={label}
          >
            <Icon size={15} aria-hidden="true" />
          </span>
        </label>
      ))}
    </fieldset>
  );
}
