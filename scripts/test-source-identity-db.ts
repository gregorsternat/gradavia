import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createNodeClient } from "../packages/db/src/node";

/** History must find two ambiguous matches without scanning a whole campaign. */
export async function testSourceIdentityLookup(connection: string) {
  const { client } = createNodeClient(connection);
  await client.connect();
  try {
    await client.query("BEGIN");
    const source = (
      await client.query(
        "SELECT release_id::text, campaign FROM raw_records LIMIT 1",
      )
    ).rows[0];
    assert(source, "Formation fixtures must exist before the lookup probe");
    await client.query(
      `INSERT INTO raw_records (release_id, row_number, campaign, payload)
       SELECT $1::uuid, 1000000 + n, $2,
         jsonb_build_object('cod_aff_form', CASE WHEN n >= 19999 THEN 'history-probe' ELSE 'noise-' || n END,
                            'cod_uai', 'history-school')
       FROM generate_series(1, 20000) n`,
      [source.release_id, source.campaign],
    );
    await client.query("ANALYZE raw_records");
    const query = await readFile(
      "crates/api/src/analytics/formation-history.sql",
      "utf8",
    );
    const parameters = [
      [source.release_id],
      [source.campaign],
      "history-probe",
      "history-school",
    ];
    assert.equal((await client.query(query, parameters)).rowCount, 2);
    assert.equal(
      (await client.query(query, [...parameters.slice(0, 3), "other-school"]))
        .rowCount,
      0,
      "Source identity includes the exact establishment",
    );
    const plan = (
      await client.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        parameters,
      )
    ).rows[0]["QUERY PLAN"][0];
    await writeFile(
      path.resolve(
        process.env.ARTIFACTS_DIR ?? ".artifacts",
        "database/source-identity-plan.json",
      ),
      JSON.stringify(plan, null, 2),
    );
    const nodes = [plan.Plan];
    for (const node of nodes) {
      assert(
        (node["Actual Rows"] ?? 0) + (node["Rows Removed by Filter"] ?? 0) <=
          16,
        "History lookup must remain bounded by identity, not campaign size",
      );
      nodes.push(...(node.Plans ?? []));
    }
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}
