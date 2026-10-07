"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectField } from "@/features/formations/ui/shared";
import { representationUrl, scopeUrl } from "../domain/navigation";

export function FormationNavigation({
  campaign,
  family = "parcoursup",
  release,
}: {
  campaign?: number;
  family?: string;
  release?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const router = useRouter();
  if (family === "apb") return null;
  const params = new URLSearchParams(search);
  if (release) params.set("version", release);
  if (campaign) params.set("campagne", String(campaign));
  if (family === "apprentissage") params.set("famille", family);
  const view =
    pathname === "/formations" || search.get("vue") === "liste"
      ? "liste"
      : "carte";
  const incompatible =
    family === "parcoursup" &&
    (pathname === "/formations"
      ? ["departement", "selectivite"].some((key) => params.has(key)) ||
        ["admis", "acces"].includes(params.get("tri") ?? "")
      : [
          "ville",
          "interet",
          "places_min",
          "places_max",
          "acces_min",
          "acces_max",
          "voeux_min",
          "voeux_max",
          "similaire",
        ].some((key) => params.has(key)) ||
        ["distance", "priorities"].includes(params.get("tri") ?? ""));
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <SelectField
          label="Périmètre des formations"
          value={family}
          onChange={(next) => router.push(scopeUrl(params, next, view))}
          options={[
            { value: "parcoursup", label: "Hors apprentissage" },
            { value: "apprentissage", label: "Apprentissage" },
          ]}
          className="w-full sm:w-56"
        />
        <nav
          aria-label="Affichage des formations"
          className="flex rounded-lg bg-subtle p-1"
        >
          {(["liste", "carte"] as const).map((next) => (
            <Link
              prefetch={false}
              key={next}
              href={representationUrl(pathname, params, next)}
              aria-current={view === next ? "page" : undefined}
              className={`rounded-md px-4 py-1.5 text-sm ${view === next ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {next === "liste" ? "Liste" : "Carte"}
            </Link>
          ))}
        </nav>
      </div>
      {incompatible && (
        <p className="text-xs text-muted-foreground">
          Certains critères actifs ne sont disponibles que dans cette vue. Ils
          ne seront pas appliqués en passant à la{" "}
          {view === "liste" ? "carte" : "liste"}.
        </p>
      )}
      <details className="text-xs leading-5 text-muted-foreground">
        <summary className="w-fit cursor-pointer">
          Ce qui est conservé en changeant de vue ou de périmètre
        </summary>
        <p className="mt-2 max-w-3xl">
          {family === "apprentissage"
            ? "La liste et la carte conservent la même version, les filtres et le tri. La zone visible de la carte n’est pas un filtre de la liste."
            : "Liste et carte conservent la campagne, la recherche, le type, la région, le statut et les tris par intitulé, places ou candidatures. Le département, la sélectivité, les autres tris et les critères propres à la carte ne sont pas transférés. La liste utilise la dernière version publiée de la campagne ; une version archivée de la carte n’est pas conservée."}{" "}
          Changer de périmètre conserve uniquement la recherche et choisit la
          dernière campagne disponible. Les populations et indicateurs diffèrent
          selon la source.
        </p>
      </details>
    </div>
  );
}
