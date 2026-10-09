import {
  panelParams,
  type PanelId,
} from "../../web/src/features/workspace/domain/registry";
import { parseDatasetQuery } from "../../web/src/features/atlas/domain/export";
import { atlasKey, selectAtlas, type Publication } from "./publication";
import { formationId } from "../../web/src/features/formations/domain/api-contract";
import type { Environment } from "./handler";
const asset = (env: Environment, path: string) =>
  env.PUBLICATION.fetch(new Request(`https://publication.internal/${path}`));
const failure = (code: string, status: number, cors = false) =>
  Response.json(
    { error: { code } },
    {
      status,
      headers: {
        "cache-control": "no-store",
        ...(cors ? { "access-control-allow-origin": "*" } : {}),
      },
    },
  );
async function metadata(env: Environment): Promise<Publication> {
  const response = await asset(env, "publication.json");
  if (!response.ok) throw new Error("Missing publication");
  const data = (await response.json()) as Publication;
  if (
    data.format !== 1 ||
    !Array.isArray(data.atlases) ||
    !Array.isArray(data.pointers)
  )
    throw new Error("Invalid publication");
  return data;
}
export async function dataset(
  request: Request,
  env: Environment,
): Promise<Response> {
  const query = parseDatasetQuery(new URL(request.url).search);
  if (!query) return failure("invalid_query", 400, true);
  const publication = await metadata(env);
  const ref = selectAtlas(publication, new URLSearchParams(query));
  if (ref === "invalid") return failure("invalid_query", 400, true);
  if (!ref)
    return query.version || query.campagne
      ? failure("not_found", 404, true)
      : Response.json(
          { status: "empty" },
          {
            headers: {
              "access-control-allow-origin": "*",
              "cache-control": "no-store",
            },
          },
        );
  const response = await asset(
    env,
    `datasets/${atlasKey(ref)}/${query.format === "json" ? `json-${query.version ? "pinned" : "current"}` : query.format}`,
  );
  if (!response.ok) return failure("unavailable", 503, true);
  const params = new URLSearchParams({
    famille: ref.family,
    campagne: String(ref.campaign),
    version: ref.releaseId,
    format: "metadata",
  });
  const headers = new Headers({
    "cache-control": query.version
      ? "public, max-age=31536000, immutable"
      : "no-store",
    "access-control-allow-origin": "*",
    "x-content-type-options": "nosniff",
    link: `</api/v1/datasets?${params}>; rel="describedby"`,
    "content-type":
      query.format === "csv" ? "text/csv; charset=utf-8" : "application/json",
  });
  if (query.format === "csv")
    headers.set(
      "content-disposition",
      `attachment; filename="gradavia-${ref.family}-${ref.campaign}-${ref.releaseId}.csv"`,
    );
  return new Response(request.method === "HEAD" ? null : response.body, {
    headers,
  });
}
async function envelope(response: Response, kind: string, notFound = false) {
  if (!response.ok)
    return Response.json({
      kind,
      result: {
        status:
          response.status === 404 && notFound ? "not-found" : "unavailable",
      },
    });
  const prefix = new TextEncoder().encode(
    `{"kind":${JSON.stringify(kind)},"result":`,
  );
  const suffix = new TextEncoder().encode("}");
  const body = response.body!;
  // Preserve backpressure: no parsing or copying multi-megabyte atlas payloads.
  const reader = body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(prefix);
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) {
        controller.enqueue(suffix);
        controller.close();
      } else controller.enqueue(next.value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/json" },
  });
}
export async function staticPanel(
  panel: PanelId,
  input: URLSearchParams,
  env: Environment,
): Promise<Response | undefined> {
  const params = panelParams(panel, input);
  if (
    [
      "carte",
      "apprentissage",
      "apprentissage-carte",
      "archives",
      "analyses",
    ].includes(panel)
  ) {
    const query = new URLSearchParams();
    for (const key of ["famille", "campagne", "version"])
      if (params.has(key))
        query.set(key, params.get(key)!.trim().slice(0, 160));
    return envelope(
      await env.GRADAVIA_API.fetch(
        new Request(`https://gradavia-api.internal/v1/atlas?${query}`),
      ),
      "atlas",
      true,
    );
  }
  if (["overview", "territoires", "sources", "donnees"].includes(panel)) {
    const overview = panel === "overview" || panel === "territoires";
    const campaign = params.get("campagne");
    const query =
      overview && campaign && /^\d{4}$/.test(campaign)
        ? `?campagne=${campaign}`
        : "";
    return envelope(
      await env.GRADAVIA_API.fetch(
        new Request(
          `https://gradavia-api.internal/v1/${overview ? "overview" : "sources"}${query}`,
        ),
      ),
      overview ? "overview" : "sources",
    );
  }
  if (panel === "modalites") {
    const values = Object.fromEntries(
      ["classique", "apprenti", "q_classique", "q_apprenti", "campagne"].map(
        (key) => [key, (params.get(key) ?? "").slice(0, 160)],
      ),
    );
    const classicId = formationId.safeParse(values.classique).success
      ? values.classique!
      : "";
    const apprenticeId = formationId.safeParse(values.apprenti).success
      ? values.apprenti!
      : "";
    const choices = async (
      family: string,
      id: string,
      q: string,
      year: string,
    ) => {
      const query = new URLSearchParams({ famille: family, id, q });
      if (id) query.set("version", id.split(":")[0]!);
      if (year) query.set("campagne", year);
      const response = await env.GRADAVIA_API.fetch(
        new Request(`https://gradavia-api.internal/internal/choices?${query}`),
      );
      if (!response.ok)
        return {
          status: response.status === 404 ? "not-found" : "unavailable",
        };
      return (await response.json()) as {
        status: string;
        data?: { source: { campaign: number } };
      };
    };
    const classic = await choices(
      "parcoursup",
      classicId,
      values.q_classique!,
      values.campagne!,
    );
    if (classic.status !== "ready" || !classic.data)
      return Response.json({ kind: panel, result: { status: classic.status } });
    const apprentice = await choices(
      "apprentissage",
      apprenticeId,
      values.q_apprenti!,
      String(classic.data.source.campaign),
    );
    if (apprentice.status !== "ready" || !apprentice.data)
      return Response.json({
        kind: panel,
        result: { status: apprentice.status },
      });
    return Response.json({
      kind: panel,
      result: {
        status: "ready",
        classic: classic.data,
        apprentice: apprentice.data,
        params: {
          ...values,
          classique: classicId,
          apprenti: apprenticeId,
          campagne: String(classic.data.source.campaign),
        },
      },
    });
  }
  if (panel !== "evolutions" && panel !== "decouvrir") return;
  const publication = await metadata(env);
  const empty = (status: string) =>
    Response.json({ kind: panel, result: { status } });
  const query = (
    family: string | null,
    campaign: string | null,
    version: string | null,
  ) => {
    const p = new URLSearchParams({ famille: family || "parcoursup" });
    if (campaign !== null) p.set("campagne", campaign.trim().slice(0, 160));
    if (version !== null) p.set("version", version.trim().slice(0, 160));
    return p;
  };
  const after = selectAtlas(
    publication,
    panel === "decouvrir"
      ? query("parcoursup", params.get("campagne"), params.get("version"))
      : query(
          params.get("famille"),
          params.get("fin"),
          params.get("version_fin"),
        ),
  );
  if (after === "invalid") return empty("unavailable");
  if (!after) return empty("not-found");
  let path = `panels/decouvrir/${atlasKey(after)}.json`;
  if (panel === "evolutions") {
    const prior = publication.atlases
      .filter(
        (a) =>
          a.family === after.family &&
          a.campaign < after.campaign &&
          publication.pointers.some(
            (p) => p.dataset === a.datasetId && p.release === a.releaseId,
          ),
      )
      .sort((a, b) => b.campaign - a.campaign)[0];
    const year = params.get("debut") ?? (prior ? String(prior.campaign) : null);
    if (!year) return empty("empty");
    const before = selectAtlas(
      publication,
      query(after.family, year, params.get("version_debut")),
    );
    if (before === "invalid") return empty("unavailable");
    if (!before) return empty("not-found");
    if (before.campaign === after.campaign) return empty("empty");
    path = `panels/evolutions/${atlasKey(before)}--${atlasKey(after)}.json`;
  }
  const response = await asset(env, path);
  return response.ok
    ? new Response(response.body, {
        headers: { "content-type": "application/json" },
      })
    : empty("unavailable");
}
