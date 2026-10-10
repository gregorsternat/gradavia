import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { addArtifact, readArtifact, type Manifest } from "./publication-assets";
import { atlasResponse } from "../apps/web/src/features/atlas/domain/api-contract";
import {
  datasetMetadata,
  datasetCsv,
} from "../apps/web/src/features/atlas/domain/export";
import { prepareEvolution } from "../apps/web/src/features/evolution/domain/evolution";
import { sourceQuiz } from "../apps/web/src/features/discovery/domain/quiz";
import { atlasKey, type Publication } from "../apps/free-web/src/publication";

export async function enrichPublication(root: string, manifest: Manifest) {
  const publication: Publication = JSON.parse(
    await readFile(join(root, "publication.json"), "utf8"),
  );
  const load = async (a: Publication["atlases"][number]) => {
    const result = atlasResponse.parse(
      JSON.parse(
        (
          await readArtifact(
            root,
            `atlas/${a.family}/${a.releaseId}/${a.campaign}.json`,
          )
        ).toString(),
      ),
    );
    if (result.status !== "ready")
      throw new Error("Missing atlas in publication");
    return result.data;
  };
  // Keep only two atlases live at once, including when preparing retained histories.
  for (const atlas of publication.atlases) {
    const data = await load(atlas);
    const key = atlasKey(atlas);
    const meta = datasetMetadata(data);
    await addArtifact(
      root,
      manifest,
      `datasets/${key}/metadata`,
      JSON.stringify(meta),
    );
    await addArtifact(root, manifest, `datasets/${key}/csv`, datasetCsv(data));
    for (const immutable of [false, true])
      await addArtifact(
        root,
        manifest,
        `datasets/${key}/json-${immutable ? "pinned" : "current"}`,
        JSON.stringify({
          status: "ready",
          data: immutable
            ? { ...data, campaigns: [data.source.campaign] }
            : data,
          metadata: meta,
        }),
      );
    if (atlas.family === "parcoursup")
      await addArtifact(
        root,
        manifest,
        `panels/decouvrir/${key}.json`,
        JSON.stringify({
          kind: "decouvrir",
          result: {
            status: "ready",
            questions: sourceQuiz(data),
            source: data.source,
          },
        }),
      );
    for (const before of publication.atlases.filter(
      (a) => a.family === atlas.family && a.campaign !== atlas.campaign,
    ))
      await addArtifact(
        root,
        manifest,
        `panels/evolutions/${atlasKey(before)}--${key}.json`,
        JSON.stringify({
          kind: "evolutions",
          result: {
            status: "ready",
            data: prepareEvolution(await load(before), data),
          },
        }),
      );
  }
}
