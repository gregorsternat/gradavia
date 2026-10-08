import Link from "@/features/workspace/ui/navigation";
import type { Breadcrumb } from "../domain/structured-data";

export function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  return (
    <nav
      aria-label="Fil d’Ariane"
      className="mb-5 text-xs leading-5 text-muted-foreground"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, index) => (
          <li
            key={item.path}
            className="inline-flex min-w-0 items-baseline gap-2"
          >
            {index > 0 && <span aria-hidden="true">/</span>}
            {index === items.length - 1 ? (
              <span aria-current="page" className="break-words">
                {item.name}
              </span>
            ) : (
              <Link
                href={item.path}
                prefetch={false}
                className="underline-offset-4 hover:underline"
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
