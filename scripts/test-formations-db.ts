import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createNodeClient } from "../packages/db/src/node";
import { rawRecords, sourceDatasets } from "../packages/db/src/schema";
import { startApi } from "./runtime";
import { seedFormations } from "./seed-formations";
import { explorerResponse } from "../apps/web/src/features/formations/domain/api-contract";
import type {
  ExplorerResult,
  SearchParams,
} from "../apps/web/src/features/formations/domain/explorer";
import path from "node:path";
import {
  fixtureCampaigns,
  fixturePayloads,
} from "../tests/fixtures/formations";

export async function testFormationReads(connection: string) {
  await seedFormations(connection);
  const api = await startApi(
    connection,
    path.resolve(process.env.ARTIFACTS_DIR ?? ".artifacts", "database"),
  );
  const { client, db } = createNodeClient(connection);
  await client.connect();
  try {
    const ready = (result: ExplorerResult) => {
      assert.equal(result.status, "ready", "Reader returns a ready result");
      if (result.status !== "ready") throw new Error("Expected ready data");
      return result.data;
    };
    const response = async (params: SearchParams = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        for (const item of Array.isArray(value)
          ? value
          : value === undefined
            ? []
            : [value])
          query.append(key, item);
      }
      const result = await fetch(`${api.url}/v1/formations?${query}`, {
        signal: AbortSignal.timeout(15_000),
      });
      assert.equal(result.status, 200, "Rust API returns successful reads");
      assert.equal(result.headers.get("cache-control"), "no-store");
      return explorerResponse.parse(await result.json());
    };
    const read = async (params: SearchParams = {}) =>
      ready(await response(params));
    const first = await read();
    assert.deepEqual(
      first.campaigns,
      fixtureCampaigns,
      "Campaigns come from current releases",
    );
    assert.equal(first.total, 31, "Latest campaign count");
    assert.equal(first.formations.length, 25, "Bounded page size");
    for (const campaign of fixtureCampaigns) {
      const result = await read({ campagne: String(campaign) });
      const count = await client.query(
        "SELECT count(*)::int AS total FROM raw_records WHERE release_id = $1 AND campaign = $2",
        [result.source.releaseId, campaign],
      );
      assert.equal(
        result.total,
        count.rows[0].total,
        "Every campaign matches independent SQL",
      );
    }
    assert.equal(
      (await read({ q: ["BTS", "ignored"] })).total,
      1,
      "Repeated parameters use their first value",
    );
    const second = await read({ page: "2" });
    assert.equal(second.formations.length, 6, "Last page size");
    assert.equal(
      new Set([...first.formations, ...second.formations].map((f) => f.id))
        .size,
      31,
      "Stable pagination retains duplicate source rows",
    );
    assert.equal(
      (await read({ page: "99999" })).query.page,
      2,
      "Out-of-range pages clamp",
    );
    const economics = await read({ q: "ECOLE etampes" });
    assert.equal(
      economics.total,
      2,
      "Accent/case insensitive words across fields",
    );
    assert.notEqual(
      economics.formations[0]!.id,
      economics.formations[1]!.id,
      "Duplicates retain row identity",
    );
    assert.equal(
      (await read({ q: "%_" })).total,
      1,
      "LIKE wildcards are literal",
    );
    assert.equal(
      (await read({ q: "' OR 1=1 --" })).total,
      0,
      "Search is parameterized",
    );
    assert.equal((await read({ q: "\\" })).total, 0, "Backslash is literal");
    assert.equal(
      (
        await read({
          type: "Licence",
          region: "Ile-de-France",
          departement: "Essonne",
          statut: "Public",
          selectivite: "Non sélective",
        })
      ).total,
      2,
      "Filters combine with AND",
    );
    assert.equal(
      (await read({ region: "Ile-de-France", departement: "Rhône" })).total,
      0,
      "Conflicting filters are empty",
    );
    assert.equal(
      first.formations[0]!.parcoursupUrl,
      null,
      "Unsafe source links are omitted",
    );
    const old = await read({
      campagne: "2018",
      statut: "Public",
      selectivite: "Sélective",
    });
    assert.equal(old.total, 1, "Historical campaign stays separate");
    assert.equal(
      old.formations[0]!.title,
      "Licence - Droit — Droit — Parcours européen",
      "Historical title composition",
    );
    assert.equal(old.formations[0]!.city, null, "No invented historical city");
    assert.equal(
      old.formations[0]!.status,
      null,
      "No invented historical status",
    );
    assert.equal(old.notices.length, 2, "Unavailable filters are explained");
    assert.equal(
      (await read({ campagne: "2019" })).formations[0]!.establishment,
      null,
      "Whitespace-only descriptions remain unavailable",
    );
    assert.equal(
      (await read({ campagne: "2020", selectivite: "Non sélective" })).total,
      1,
      "Legacy selectivity spelling",
    );

    const replacement = randomUUID();
    await db.execute(sql`INSERT INTO source_releases
      SELECT ${replacement}::uuid, dataset_id, repeat('f',64), contract_version, collected_at,
      source_modified_at, importer_version, license, metadata, manifest, manifest_path,
      1, data_bytes, '{"2025":1}'::jsonb, created_at
      FROM source_releases WHERE id = ${first.source.releaseId}::uuid`);
    await db.insert(rawRecords).values({
      releaseId: replacement,
      rowNumber: 1,
      campaign: 2025,
      payload: {
        ...fixturePayloads(2025)[0],
        lib_for_voe_ins: "Nouvelle version",
      },
    });
    // Block only the rows query, then publish a replacement after discovery.
    // This is a real HTTP/database race, with no test hook in production code.
    const blocker = createNodeClient(connection).client;
    await blocker.connect();
    let pending: ReturnType<typeof read> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("LOCK TABLE raw_records IN ACCESS EXCLUSIVE MODE");
      pending = read();
      let waiting = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        const result = await client.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'orvio-api' AND wait_event_type = 'Lock'",
        );
        if (result.rowCount) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      assert(
        waiting,
        "HTTP reader captured its release before the rows query blocked",
      );
      await db
        .update(sourceDatasets)
        .set({ currentReleaseId: replacement })
        .where(eq(sourceDatasets.id, "fr-esr-parcoursup"));
    } finally {
      await blocker.query("ROLLBACK");
      await blocker.end();
    }
    const duringPublication = await pending!;
    assert.equal(
      duringPublication.total,
      31,
      "Captured release remains coherent after publication",
    );
    assert.equal(
      duringPublication.source.releaseId,
      first.source.releaseId,
      "Provenance matches displayed rows",
    );
    assert.equal(
      (await read()).total,
      1,
      "Next request sees the newly published release",
    );
    await db.update(sourceDatasets).set({ currentReleaseId: null });
    assert.equal(
      (await response()).status,
      "empty",
      "No current release is an explicit empty state",
    );
    await client.query(
      "ALTER TABLE source_datasets RENAME TO temporarily_unavailable_datasets",
    );
    try {
      const failed = await fetch(`${api.url}/v1/formations`);
      assert.equal(
        failed.status,
        503,
        "SQL errors become an unavailable HTTP response",
      );
      assert.equal(failed.headers.get("retry-after"), "5");
      assert.deepEqual(
        await failed.json(),
        { error: { code: "unavailable" } },
        "No raw SQL details escape the boundary",
      );
    } finally {
      await client.query(
        "ALTER TABLE temporarily_unavailable_datasets RENAME TO source_datasets",
      );
    }
  } finally {
    await api.stop();
    await client.query(
      "TRUNCATE source_datasets, source_releases, raw_records, ingestion_runs CASCADE",
    );
    await client.end();
  }
}
