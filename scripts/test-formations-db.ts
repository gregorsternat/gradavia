import assert from "node:assert/strict";
import {
  atlasResponse,
  atlasDetailResponse,
} from "../apps/web/src/features/atlas/domain/api-contract";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createNodeClient } from "../packages/db/src/node";
import { rawRecords, sourceDatasets } from "../packages/db/src/schema";
import { startApi } from "./runtime";
import { seedFormations } from "./seed-formations";
import { testSourceIdentityLookup } from "./test-source-identity-db";
import {
  detailResponse,
  explorerResponse,
} from "../apps/web/src/features/formations/domain/api-contract";
import {
  overviewResponse,
  sourcesResponse,
} from "../apps/web/src/features/observatory/domain/overview";
import { specialtyResponse } from "../apps/web/src/features/specialties/domain/api-contract";
import { inverseResponse } from "../apps/web/src/features/specialties/domain/inverse";
import {
  defaultSpecialtyPair,
  secondSpecialtyPair,
} from "../tests/fixtures/specialties";
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
    await testSourceIdentityLookup(connection);
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

    const jsonEndpoint = async (pathname: string) => {
      const result = await fetch(`${api.url}${pathname}`, {
        signal: AbortSignal.timeout(15_000),
      });
      assert.equal(
        result.status,
        200,
        `Successful analytics endpoint: ${pathname}`,
      );
      assert.equal(result.headers.get("cache-control"), "no-store");
      return result.json();
    };
    // Independent mutations exercise all statistical value states and continuity.
    const cases = [0, null, "ns", -3];
    for (const [index, capacity] of cases.entries()) {
      await client.query(
        "UPDATE raw_records SET payload = payload || $3::jsonb WHERE release_id = $1::uuid AND row_number = $2",
        [
          first.source.releaseId,
          index + 1,
          JSON.stringify({
            capa_fin: capacity,
            cod_aff_form: `test-law-${index}`,
            cod_uai: "TEST-UAI",
            taux_acces_ens: index === 3 ? 101 : index * 20,
          }),
        ],
      );
    }
    await client.query(
      "UPDATE raw_records SET payload = payload || $1::jsonb WHERE campaign < 2025",
      [JSON.stringify({ cod_aff_form: "test-law-0", cod_uai: "TEST-UAI" })],
    );
    const states = ["observed", "missing", "suppressed", "invalid"];
    for (const [index, state] of states.entries()) {
      const detail = detailResponse.parse(
        await jsonEndpoint(
          `/v1/formations/${first.source.releaseId}:${index + 1}`,
        ),
      ).data;
      assert.equal(
        detail.formation.metrics.capacity.state,
        state,
        "Source value state remains explicit",
      );
      assert.equal(
        detail.formation.metrics.capacity.value,
        index === 0 ? 0 : null,
        "Missing and suppressed counts never become zero",
      );
      assert.equal(
        detail.definitions.length,
        10,
        "Each exposed indicator has a definition",
      );
      if (index === 0) {
        assert.equal(
          detail.history.length,
          8,
          "All published campaigns have history slots",
        );
        assert.equal(
          detail.history[0]!.continuity,
          "changed-description",
          "Historical description changes are marked",
        );
        assert.equal(
          detail.history.at(-1)!.continuity,
          "same-source-identity",
          "Same source identity is recognizable",
        );
      }
    }
    const ambiguous = detailResponse.parse(
      await jsonEndpoint(`/v1/formations/${economics.formations[0]!.id}`),
    );
    assert.equal(
      ambiguous.data.history.at(-1)!.continuity,
      "ambiguous",
      "Duplicate identities are never silently collapsed into a historical series",
    );
    assert.equal(ambiguous.data.history.at(-1)!.metrics, null);
    const detailId = `${first.source.releaseId}:1`;
    const canonical = detailResponse.parse(
      await jsonEndpoint(
        `/v1/formations/${first.source.releaseId.toUpperCase()}:1`,
      ),
    );
    assert.equal(
      canonical.data.formation.id,
      detailId,
      "UUID input normalizes to captured source identity",
    );
    const invalidDetail = await fetch(`${api.url}/v1/formations/not-a-record`);
    assert.equal(
      invalidDetail.status,
      404,
      "Invalid IDs cannot reach SQL casts",
    );
    const missingDetail = await fetch(
      `${api.url}/v1/formations/${first.source.releaseId}:999999`,
    );
    assert.equal(missingDetail.status, 404, "Unknown rows return not found");
    const sorted = await read({ tri: "capacite" });
    assert.equal(sorted.query.tri, "capacite");
    const observedCapacities = sorted.formations
      .map((f) => f.metrics.capacity.value)
      .filter((n): n is number => n !== null);
    assert.deepEqual(
      observedCapacities,
      [...observedCapacities].sort((a, b) => b - a),
      "Capacity sort uses source values descending",
    );
    assert.equal(
      (await read({ tri: "arbitrary" })).query.tri,
      "nom",
      "Unknown sorts have a safe default",
    );
    const overview = overviewResponse.parse(await jsonEndpoint("/v1/overview"));
    assert.equal(overview.status, "ready");
    if (overview.status !== "ready") throw new Error("Expected an overview");
    assert.equal(
      overview.data.totals.formations,
      31,
      "Overview counts source rows, preserving duplicates",
    );
    assert.equal(overview.data.totals.capacity.total, 31);
    const capacityCoverage = overview.data.coverage.find(
      (item: { key: string }) => item.key === "capacity",
    );
    assert(
      capacityCoverage!.missing >= 1 &&
        capacityCoverage!.suppressed >= 1 &&
        capacityCoverage!.invalid >= 1,
      "Coverage exposes all non-observed cases",
    );
    assert.equal(
      overview.data.byType.reduce(
        (sum: number, group: { formations: number }) => sum + group.formations,
        0,
      ),
      31,
      "Breakdowns reconcile exactly to the selected source",
    );
    assert.equal(
      overview.data.accessDistribution.reduce(
        (sum: number, bucket: { count: number }) => sum + bucket.count,
        0,
      ),
      overview.data.coverage.find(
        (item: { key: string }) => item.key === "accessRate",
      )!.observed,
      "Histogram excludes invalid and unavailable access rates",
    );
    assert.equal(
      overview.data.history.length,
      8,
      "Aggregate history contains one distinct observation per campaign",
    );
    assert.deepEqual(
      overview.data.history.at(-1)!.capacity,
      overview.data.totals.capacity,
      "History and current coverage agree",
    );
    const inventory = sourcesResponse.parse(await jsonEndpoint("/v1/sources"));
    assert.equal(
      inventory.data.datasets.length,
      14,
      "Inventory includes the complete committed registry",
    );
    assert.equal(
      inventory.data.totals.published,
      11,
      "Only published datasets count as available",
    );
    assert(
      inventory.data.datasets.some(
        (dataset: { family: string; status: string }) =>
          dataset.family === "formation_map" &&
          dataset.status === "not-imported",
      ),
      "Unimported cartography is not represented as imported",
    );

    const readSpecialties = async (
      params: URLSearchParams = new URLSearchParams(),
    ) => {
      const result = specialtyResponse.parse(
        await jsonEndpoint(`/v1/specialties?${params}`),
      );
      assert.equal(result.status, "ready");
      if (result.status !== "ready")
        throw new Error("Expected specialty observations");
      return result.data;
    };
    const specialties = await readSpecialties();
    assert.equal(specialties.source.campaign, 2025);
    assert.deepEqual(
      specialties.selectedPair.specialties,
      defaultSpecialtyPair,
    );
    assert.equal(
      specialties.national!.applications.value,
      1000,
      "National population comes from level 0",
    );
    assert.equal(
      specialties.groups.reduce(
        (sum, row) => sum + (row.applications.value ?? 0),
        0,
      ),
      1570,
      "Overlapping group counts are not collapsed into the national population",
    );
    assert.equal(
      specialties.formations.length,
      0,
      "No group drill is selected implicitly",
    );
    const cpge = await readSpecialties(
      new URLSearchParams({
        paire: specialties.selectedPair.id,
        groupe: "CPGE",
      }),
    );
    assert.equal(cpge.formations.length, 2);
    assert(
      cpge.formations.every((formation) => formation.group === "CPGE"),
      "Drill rows preserve the selected source scope",
    );
    const but = await readSpecialties(
      new URLSearchParams({
        paire: specialties.selectedPair.id,
        groupe: "BUT",
      }),
    );
    assert.equal(
      but.formations.find(
        (formation) => formation.formation === "BUT - Informatique",
      )!.accepted.state,
      "suppressed",
    );
    assert.equal(
      but.formations.find(
        (formation) => formation.formation === "BUT - Chimie",
      )!.accepted.value,
      0,
    );
    const other = await readSpecialties(
      new URLSearchParams({ paire: JSON.stringify(secondSpecialtyPair) }),
    );
    assert.equal(other.national!.applications.value, 800);
    const invalidSpecialtyQuery = await readSpecialties(
      new URLSearchParams({ paire: "missing", groupe: "unknown" }),
    );
    assert.equal(
      invalidSpecialtyQuery.requestNotices.length,
      2,
      "Unknown specialty selections are explained",
    );
    assert.equal(invalidSpecialtyQuery.query.groupe, "");
    const longSpecialtyQuery = await fetch(
      `${api.url}/v1/specialties?paire=${"x".repeat(17000)}`,
    );
    assert.equal(
      longSpecialtyQuery.status,
      400,
      "Specialty query input is bounded",
    );
    const inverseCatalog = inverseResponse.parse(
      await jsonEndpoint("/v1/specialties/inverse"),
    );
    assert.equal(inverseCatalog.status, "ready");
    if (inverseCatalog.status !== "ready")
      throw new Error("Expected inverse specialty catalog");
    assert.equal(
      inverseCatalog.data.rows.length,
      0,
      "No national label is selected implicitly",
    );
    const inverseInformatics = inverseCatalog.data.formations.find(
      (row) => row.group === "BUT" && row.label === "BUT - Informatique",
    );
    assert(inverseInformatics);
    const inverseResult = inverseResponse.parse(
      await jsonEndpoint(
        `/v1/specialties/inverse?${new URLSearchParams({ formation: inverseInformatics.id })}`,
      ),
    );
    assert.equal(inverseResult.status, "ready");
    if (inverseResult.status !== "ready")
      throw new Error("Expected inverse specialty observations");
    assert.equal(inverseResult.data.rows.length, 1);
    assert.deepEqual(
      inverseResult.data.rows[0]!.pair.specialties,
      defaultSpecialtyPair,
    );
    assert.equal(inverseResult.data.rows[0]!.accepted.state, "suppressed");
    assert.equal(inverseResult.data.rows[0]!.applications.value, 150);
    assert.equal(inverseResult.data.rows[0]!.group, "BUT");
    const inverseUnknown = inverseResponse.parse(
      await jsonEndpoint(`/v1/specialties/inverse?formation=unknown`),
    );
    assert.equal(inverseUnknown.status, "ready");
    if (inverseUnknown.status === "ready") {
      assert.equal(inverseUnknown.data.rows.length, 0);
      assert.equal(inverseUnknown.data.requestNotices.length, 1);
    }
    assert.equal(
      (
        await fetch(
          `${api.url}/v1/specialties/inverse?formation=${"x".repeat(17000)}`,
        )
      ).status,
      400,
    );

    const snapshot = atlasResponse.parse(await jsonEndpoint("/v1/atlas"));
    assert.equal(snapshot.status, "ready");
    if (snapshot.status !== "ready") throw new Error("Expected snapshot");
    assert.equal(
      snapshot.data.items.length,
      31,
      "Atlas retains every row and duplicate",
    );
    assert(
      snapshot.data.items.some(
        (item) =>
          item.metrics.capacity === null && item.states.capacity === "missing",
      ),
    );
    assert(
      snapshot.data.items.some(
        (item) =>
          item.metrics.admitted === 0 && item.states.admitted === undefined,
      ),
    );
    assert(
      snapshot.data.items.some((item) => item.states.admitted === "suppressed"),
    );
    assert(
      snapshot.data.items.some((item) => item.states.accessRate === "invalid"),
    );
    assert.equal(snapshot.data.items[0]!.latitude, 45.75);
    const rich = atlasDetailResponse.parse(
      await jsonEndpoint(`/v1/atlas/formations/${snapshot.data.items[0]!.id}`),
    );
    assert.equal(rich.data.metrics.mentionNone!.value, 20);
    assert.equal(rich.data.metrics.admittedBeforeBac!.value, 110);
    assert.equal(rich.data.rankGroups[0]!.rank.value, 850);
    assert.equal(rich.data.history.length, 8);
    const apb = atlasResponse.parse(
      await jsonEndpoint("/v1/atlas?famille=apb"),
    );
    assert.equal(apb.status, "ready");
    if (apb.status === "ready") {
      assert.equal(apb.data.source.campaign, 2017);
      assert.equal(apb.data.items[0]!.metrics.scholarshipShare, 25.8);
      assert.equal(apb.data.items[0]!.latitude, null);
      assert.equal(apb.data.items[0]!.sourceFormationId, null);
      assert.equal(apb.data.items[0]!.states.accessRate, "missing");
      const apbDetail = atlasDetailResponse.parse(
        await jsonEndpoint(`/v1/atlas/formations/${apb.data.items[0]!.id}`),
      );
      assert.equal(apbDetail.data.metrics.mentionNone!.value, 10);
      assert.equal(
        apbDetail.data.history.length,
        0,
        "No invented APB identity match",
      );
    }
    const apprentice = atlasResponse.parse(
      await jsonEndpoint("/v1/atlas?famille=apprentissage"),
    );
    assert.equal(apprentice.status, "ready");
    if (apprentice.status === "ready") {
      assert.equal(apprentice.data.items[0]!.states.offers, "suppressed");
      assert.equal(apprentice.data.items[0]!.states.admitted, "missing");
      const apprenticeDetail = atlasDetailResponse.parse(
        await jsonEndpoint(
          `/v1/atlas/formations/${apprentice.data.items[0]!.id}`,
        ),
      );
      assert.equal(
        apprenticeDetail.data.metrics.generalApplications!.value,
        30,
      );
      assert.equal(apprenticeDetail.data.metrics.contractSearch!.value, 12);
    }
    for (const query of [
      "famille=invalid",
      "version=not-a-uuid",
      "campagne=bad",
    ])
      assert.equal((await fetch(`${api.url}/v1/atlas?${query}`)).status, 400);
    assert.equal(
      (
        await fetch(
          `${api.url}/v1/atlas?famille=apb&version=${snapshot.data.source.releaseId}`,
        )
      ).status,
      404,
      "A pinned release cannot silently switch family",
    );
    assert.equal(
      (
        await fetch(
          `${api.url}/v1/atlas?version=${snapshot.data.source.releaseId}&campagne=2017`,
        )
      ).status,
      404,
      "A pinned release cannot silently switch campaign",
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
          "SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND application_name = 'gradavia-api' AND wait_event_type = 'Lock'",
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
    const publishedOverview = overviewResponse.parse(
      await jsonEndpoint("/v1/overview"),
    );
    assert.equal(publishedOverview.status, "ready");
    if (publishedOverview.status === "ready") {
      assert.equal(
        publishedOverview.data.totals.formations,
        1,
        "A newly published release invalidates cached aggregates immediately",
      );
      assert.equal(publishedOverview.data.source.releaseId, replacement);
    }
    const retainedDetail = detailResponse.parse(
      await jsonEndpoint(`/v1/formations/${detailId}`),
    );
    assert.equal(
      retainedDetail.data.source.releaseId,
      first.source.releaseId,
      "Saved formation links retain their original snapshot after publication",
    );
    const freshAtlas = atlasResponse.parse(await jsonEndpoint("/v1/atlas"));
    assert.equal(freshAtlas.status, "ready");
    if (freshAtlas.status === "ready") {
      assert.equal(freshAtlas.data.source.releaseId, replacement);
      assert.equal(
        freshAtlas.data.items.length,
        1,
        "Publication invalidates cached snapshots",
      );
    }
    const retainedAtlas = atlasResponse.parse(
      await jsonEndpoint(`/v1/atlas?version=${snapshot.data.source.releaseId}`),
    );
    assert.equal(retainedAtlas.status, "ready");
    if (retainedAtlas.status === "ready") {
      assert.equal(
        retainedAtlas.data.source.releaseId,
        snapshot.data.source.releaseId,
      );
      assert.equal(
        retainedAtlas.data.items.length,
        31,
        "Pinned analyses remain reproducible",
      );
    }
    const uppercaseAtlas = atlasResponse.parse(
      await jsonEndpoint(
        `/v1/atlas?version=${snapshot.data.source.releaseId.toUpperCase()}`,
      ),
    );
    assert.equal(
      uppercaseAtlas.status,
      "ready",
      "UUID selectors normalize without changing identity",
    );
    const oversizedRelease = randomUUID();
    await db.execute(sql`INSERT INTO source_releases
      SELECT ${oversizedRelease}::uuid, dataset_id, repeat('e',64), contract_version, collected_at,
      source_modified_at, importer_version, license, metadata, manifest, manifest_path,
      30001, data_bytes, '{"2025":30001}'::jsonb, created_at
      FROM source_releases WHERE id = ${first.source.releaseId}::uuid`);
    await client.query(
      "INSERT INTO raw_records (release_id,row_number,campaign,payload) SELECT $1::uuid,n,2025,payload FROM raw_records CROSS JOIN generate_series(1,30001) n WHERE release_id=$2::uuid AND row_number=1",
      [oversizedRelease, first.source.releaseId],
    );
    const oversized = await fetch(
      `${api.url}/v1/atlas?version=${oversizedRelease}`,
    );
    assert.equal(
      oversized.status,
      503,
      "A snapshot exceeding 30,000 rows fails instead of silently truncating",
    );
    await db.update(sourceDatasets).set({ currentReleaseId: null });
    assert.equal(
      (await response()).status,
      "empty",
      "No current release is an explicit empty state",
    );
    assert.equal(
      specialtyResponse.parse(await jsonEndpoint("/v1/specialties")).status,
      "empty",
      "Unpublished specialty data is explicit",
    );
    assert.equal(
      overviewResponse.parse(await jsonEndpoint("/v1/overview")).status,
      "empty",
      "Empty overview stays distinct from unavailable service",
    );
    assert.equal(
      sourcesResponse.parse(await jsonEndpoint("/v1/sources")).data.totals
        .published,
      0,
      "Inventory observes removed publication pointers",
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
