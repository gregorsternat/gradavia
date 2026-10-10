import { readFile, writeFile, rename, mkdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  fileNames,
  validatePublication,
  addArtifact,
  addDocumentArtifact,
  digest,
} from "./publication-assets";
import { startProcess, startPublicationApi, webEnvironment } from "./runtime";
import {
  panels,
  panelHref,
  type PanelId,
} from "../apps/web/src/features/workspace/domain/registry";

import { views as analysisViews } from "../apps/web/src/features/analysis/domain/analysis";
import { enrichPublication } from "./enrich-publication";
import { pageIdentity } from "../apps/free-web/src/identity";
import { snapshotRuntime } from "./publication-runtime";

const sourceRoot = resolve(
  process.argv[2] ??
    (await readFile(".artifacts/publication-fixture-path", "utf8")).trim(),
);
const workerCount = Number(process.env.PUBLICATION_RENDER_WORKERS ?? "2");
const webPort = Number(process.env.PUBLICATION_WEB_PORT ?? "3580");
if (
  !Number.isInteger(workerCount) ||
  workerCount < 1 ||
  workerCount > 8 ||
  !Number.isInteger(webPort) ||
  webPort < 1024 ||
  webPort + workerCount > 65536
)
  throw new Error("Use 1-8 render workers and a valid local port range");
const manifest = await validatePublication(sourceRoot);
if (manifest.files["pages.json"])
  throw new Error("Use a data-only publication as input");
const root = resolve(process.argv[3] || `${sourceRoot}-web`);
await mkdir(root);
for (const name of Object.keys(manifest.files)) {
  await mkdir(join(root, name, ".."), { recursive: true });
  await copyFile(join(sourceRoot, name), join(root, name));
}
const runtime = await snapshotRuntime(root);
for (const [name, record] of Object.entries(runtime))
  manifest.files[`runtime/${name}`] = record;
// The document pins both its data and frozen executable code, even when a
// Worker-only change reuses an unchanged Next build.
const publicationId = digest(
  JSON.stringify(manifest) +
    (await readFile("apps/web/.next/BUILD_ID", "utf8")),
).slice(0, 20);
await enrichPublication(root, manifest);

const metadata = JSON.parse(
  await readFile(join(root, "publication.json"), "utf8"),
);
const details = JSON.parse(
  await readFile(join(root, "details.json"), "utf8"),
) as { id: string; family: string }[];
const api = await startPublicationApi(root, join(root, ".."));
const servers: Awaited<ReturnType<typeof startProcess>>[] = [];
async function ready(origin: string, path: string) {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + path)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Publication renderer did not start");
}
try {
  const apiUrl = api.url;
  await ready(apiUrl, "/health/live");
  const origins: string[] = [];
  for (let index = 0; index < workerCount; index++) {
    const port = String(webPort + index);
    const web = await startProcess(
      "pnpm",
      ["--filter", "@gradavia/web", "start", "--port", port],
      {
        ...webEnvironment(apiUrl),
        GRADAVIA_PRERENDER: "1",
        GRADAVIA_PUBLICATION_ID: publicationId,
      },
      join(root, "..", `render-web-${index}.log`),
    );
    servers.push(web);
    const origin = `http://127.0.0.1:${port}`;
    await ready(origin, "/api/health");
    origins.push(origin);
  }
  const origin = origins[0]!;
  const paths = new Set<string>(["/"]);
  for (const panel of Object.keys(panels) as PanelId[]) {
    paths.add(panelHref(panel));
    if (
      [
        "formations",
        "carte",
        "overview",
        "territoires",
        "analyses",
        "decouvrir",
      ].includes(panel)
    )
      for (const source of metadata.sources)
        paths.add(
          panelHref(
            panel,
            new URLSearchParams({ campagne: String(source.campaign) }),
          ),
        );
  }
  for (const source of metadata.sources) {
    const data = await (
      await fetch(`${apiUrl}/v1/formations?campagne=${source.campaign}`)
    ).json();
    if (data.status !== "ready")
      throw new Error("Missing catalog during prerender");
    for (let page = 1; page <= Math.ceil(data.data.total / 25); page++) {
      paths.add(`/formations?campagne=${source.campaign}&page=${page}`);
      if (source === metadata.sources[0]) paths.add(`/formations?page=${page}`);
    }
  }
  for (const item of details) {
    paths.add(`/atlas/${encodeURIComponent(item.id)}`);
    if (item.family === "parcoursup")
      paths.add(`/formations/${encodeURIComponent(item.id)}`);
  }
  for (const view of analysisViews)
    paths.add(panelHref("analyses", new URLSearchParams({ vue: view })));
  paths.add("/comparer?ids=");
  paths.add("/favoris?ids=");
  for (const route of [...paths]) {
    const url = new URL(route, origin);
    if (
      url.pathname === "/formations" &&
      !url.searchParams.has("onglet") &&
      !url.searchParams.has("famille")
    ) {
      for (const view of ["cartes", "liste"]) {
        const variant = new URL(url);
        variant.searchParams.set("vue", view);
        paths.add(variant.pathname + variant.search);
      }
    }
  }
  for (const panel of Object.keys(panels) as PanelId[])
    paths.add(
      panelHref(panel, new URLSearchParams({ _publication_shell: "1" })),
    );
  paths.add("/not-a-gradavia-page");
  const routes: Record<string, { html: string; rsc: string }> = {};
  let done = 0;
  async function render(route: string, origin: string) {
    const key = digest(pageIdentity(route));
    const missing = route === "/not-a-gradavia-page";
    const html = await fetch(origin + route, {
      redirect: "manual",
      headers: { "User-Agent": "Twitterbot/1.0" },
    });
    if (!html.ok && !(missing && html.status === 404))
      throw new Error(
        `Public page prerender failed: ${route} (${html.status}, ${html.headers.get("location")})`,
      );
    const body = await html.text();
    if (body.includes("Cette formation est temporairement indisponible"))
      throw new Error("Unavailable detail during prerender");
    const rsc = await fetch(
      origin + route + (route.includes("?") ? "&" : "?") + "_rsc",
      { headers: { RSC: "1" }, redirect: "manual" },
    );
    if (
      (!rsc.ok && !(missing && rsc.status === 404)) ||
      !rsc.headers.get("content-type")?.includes("text/x-component")
    )
      throw new Error(
        `Navigation prerender failed: ${route} (${rsc.status}, ${rsc.headers.get("location")})`,
      );
    const shell = new URL(route, origin).searchParams.has("_publication_shell");
    const panel = (Object.keys(panels) as PanelId[]).find(
      (p) =>
        panelHref(p, new URLSearchParams({ _publication_shell: "1" })) ===
        route,
    );
    const base = missing
      ? "pages/not-found"
      : shell
        ? `shells/${panel}`
        : `pages/${key}`;
    const files = { html: `${base}.html`, rsc: `${base}.rsc` };
    await addDocumentArtifact(root, manifest, files.html, body);
    await addDocumentArtifact(root, manifest, files.rsc, await rsc.text());
    routes[route] = files;
    if (++done % 100 === 0)
      console.log(`Prerendered ${done}/${paths.size} pages`);
  }
  const pending = [...paths];
  let next = 0;
  // One request sequence per server bounds both in-flight bodies and CPU work.
  await Promise.all(
    origins.map(async (origin) => {
      while (next < pending.length) await render(pending[next++]!, origin);
    }),
  );
  for (const route of [
    "/robots.txt",
    "/sitemap.xml",
    "/sitemap-pages.xml",
    "/sitemap-formations.xml",
    "/sitemap-apprentissage.xml",
    "/sitemap-apb.xml",
    "/opengraph-image",
    "/icon.svg",
  ]) {
    const response = await fetch(origin + route);
    if (!response.ok) throw new Error("Metadata prerender failed");
    await addArtifact(
      root,
      manifest,
      `public${route}`,
      new Uint8Array(await response.arrayBuffer()),
    );
  }
  for (const name of await fileNames("apps/web/.next/static"))
    await addArtifact(
      root,
      manifest,
      `public/_next/static/${name}`,
      await readFile(join("apps/web/.next/static", name)),
    );
  for (const name of await fileNames("apps/web/public"))
    await addArtifact(
      root,
      manifest,
      `public/${name}`,
      await readFile(join("apps/web/public", name)),
    );
  await addArtifact(
    root,
    manifest,
    "pages.json",
    JSON.stringify({
      format: 1,
      publicationId,
      routes: Object.fromEntries(
        Object.entries(routes).sort(([a], [b]) => a.localeCompare(b, "en")),
      ),
    }),
  );
  await writeFile(".artifacts/publication-render-path", root);
  await writeFile(
    join(root, "manifest.json.partial"),
    JSON.stringify({
      ...manifest,
      files: Object.fromEntries(
        Object.entries(manifest.files).sort(([a], [b]) =>
          a.localeCompare(b, "en"),
        ),
      ),
    }),
  );
  await rename(
    join(root, "manifest.json.partial"),
    join(root, "manifest.json"),
  );
  console.log(
    `Prerendered ${done} pages and their Next.js navigation payloads.`,
  );
} finally {
  await Promise.all(servers.map((web) => web.stop()));
  await api.stop();
}
