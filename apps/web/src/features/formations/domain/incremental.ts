import {
  explorerResponse,
  type ExplorerData,
  type Formation,
} from "./api-contract";
import { explorerUrl, PAGE_SIZE } from "./explorer";

export const RELEASE_CHANGED =
  "Une nouvelle version des données est disponible. Rechargez la recherche pour continuer.";

/** Reject page drift instead of silently mixing populations or skipping records. */
export function appendFormationPage(
  initial: ExplorerData,
  loaded: Formation[],
  body: unknown,
): Formation[] {
  const parsed = explorerResponse.safeParse(body);
  if (!parsed.success || parsed.data.status !== "ready")
    throw new Error("Le chargement a échoué. Réessayez.");
  const next = parsed.data.data;
  if (
    next.source.releaseId !== initial.source.releaseId ||
    next.source.campaign !== initial.source.campaign
  )
    throw new Error(RELEASE_CHANGED);
  const page = initial.query.page + Math.ceil(loaded.length / PAGE_SIZE);
  if (
    next.query.page !== page ||
    next.total !== initial.total ||
    explorerUrl(next.query) !== explorerUrl(initial.query) ||
    next.formations.some((row) =>
      loaded.some((existing) => existing.id === row.id),
    )
  )
    throw new Error("La suite des résultats est incohérente. Réessayez.");
  return [...loaded, ...next.formations];
}
