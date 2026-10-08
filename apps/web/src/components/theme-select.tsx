"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/motion/radio";
import { Tooltip } from "@/components/motion/tooltip";
import { useClientReady } from "@/lib/hooks/use-client-ready";

const modes = [
  { value: "system", label: "Système", Icon: Monitor },
  { value: "light", label: "Clair", Icon: Sun },
  { value: "dark", label: "Sombre", Icon: Moon },
] as const;

export function ThemeSelect() {
  const ready = useClientReady();
  const { theme, setTheme } = useTheme();

  return (
    <RadioGroup
      aria-label="Apparence"
      orientation="horizontal"
      value={ready ? (theme ?? "system") : "system"}
      onValueChange={setTheme}
      className="w-fit flex-nowrap gap-0.5 rounded-lg bg-subtle p-1"
    >
      {modes.map(({ value, label, Icon }) => (
        <Tooltip key={value} content={label}>
          <RadioGroupItem
            value={value}
            disabled={!ready}
            label={label}
            variant="segment"
            className="size-8 min-h-8 px-0"
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </RadioGroupItem>
        </Tooltip>
      ))}
    </RadioGroup>
  );
}
