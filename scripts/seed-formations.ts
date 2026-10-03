import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createNodeClient } from "../packages/db/src/node";
import {
  rawRecords,
  sourceDatasets,
  sourceReleases,
} from "../packages/db/src/schema";
import {
  fixtureCampaigns,
  fixtureDataset,
  fixturePayloads,
} from "../tests/fixtures/formations";

/** Only the disposable database harness imports synthetic formations. */
export async function seedFormations(connection: string) {
  const { client, db } = createNodeClient(connection);
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const campaign of fixtureCampaigns) {
      const datasetId = fixtureDataset(campaign),
        releaseId = randomUUID();
      const payloads = fixturePayloads(campaign);
      await db.insert(sourceDatasets).values({
        id: datasetId,
        family: "parcoursup",
        provider: "Producteur de démonstration",
        archived: false,
      });
      await db.insert(sourceReleases).values({
        id: releaseId,
        datasetId,
        fingerprint: String(campaign).padStart(64, "0"),
        contractVersion: 1,
        collectedAt: new Date("2026-10-03T00:00:00Z"),
        sourceModifiedAt: null,
        importerVersion: "fixture",
        license: "Fixtures synthétiques",
        metadata: {
          fields: Object.keys(payloads[0]!).map((name) => ({ name })),
        },
        manifest: {},
        manifestPath: "fixture",
        rowCount: payloads.length,
        dataBytes: 1,
        campaigns: { [campaign]: payloads.length },
      });
      await db.insert(rawRecords).values(
        payloads.map((payload, i) => ({
          releaseId,
          rowNumber: i + 1,
          campaign,
          payload,
        })),
      );
      await db
        .update(sourceDatasets)
        .set({ currentReleaseId: releaseId })
        .where(eq(sourceDatasets.id, datasetId));
    }
    await client.query("COMMIT");
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}
