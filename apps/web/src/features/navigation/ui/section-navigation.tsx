"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectField } from "@/features/formations/ui/shared";
import { navigationGroup } from "../domain/navigation";

export function SectionNavigation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const group = navigationGroup(pathname, params.get("famille"));
  if (!group || group.href === "/formations" || group.href === "/specialites")
    return null;
  const current =
    group.pages.find((page) => page.href === pathname)?.href ?? "/archives";
  return (
    <nav
      aria-label={`Dans ${group.label}`}
      className="flex flex-wrap items-center gap-x-5 gap-y-3 pt-5 print:hidden"
    >
      <span className="text-xs font-medium text-muted-foreground">
        {group.label}
      </span>
      {group.href === "/observatoire" ? (
        <SelectField
          label="Rubrique de l’observatoire"
          value={current}
          onChange={(href) => {
            const campaign = params.get("campagne");
            const compatible =
              ["/observatoire", "/territoires"].includes(pathname) &&
              ["/observatoire", "/territoires"].includes(href);
            router.push(
              compatible && campaign
                ? `${href}?campagne=${encodeURIComponent(campaign)}`
                : href,
            );
          }}
          options={group.pages.map((page) => ({
            value: page.href,
            label: page.label,
          }))}
          className="w-full sm:w-64"
        />
      ) : (
        group.pages.map((page) => (
          <Link
            prefetch={false}
            key={page.href}
            href={page.href}
            aria-current={current === page.href ? "page" : undefined}
            className={`py-2 text-sm ${current === page.href ? "font-medium text-foreground underline underline-offset-8" : "text-muted-foreground hover:text-foreground"}`}
          >
            {page.label}
          </Link>
        ))
      )}
    </nav>
  );
}
