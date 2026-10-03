import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  checkClientBoundaries,
  checkDomainDependencies,
  checkWebDatabaseBoundary,
} from "../check-architecture.mjs";

function fixture(files, run) {
  const root = mkdtempSync(path.join(tmpdir(), "orvio-boundaries-"));
  for (const [name, content] of Object.entries({
    "apps/web/tsconfig.json":
      '{"compilerOptions":{"moduleResolution":"bundler","module":"esnext","paths":{"@/*":["./src/*"]}}}',
    ...files,
  })) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("rejects database access hidden behind an alias and barrel", () => {
  fixture(
    {
      "apps/web/src/card.tsx":
        '"use client"; import { query } from "@/shared";',
      "apps/web/src/shared.ts": 'export { query } from "./server/db";',
      "apps/web/src/server/db.ts": "export const query = () => 1;",
    },
    (root) => assert.equal(checkClientBoundaries(root).length, 1),
  );
});

test("rejects server-side web database imports through aliases and barrels", () => {
  fixture(
    {
      "apps/web/src/page.tsx": 'import { db } from "@/shared";',
      "apps/web/src/shared.ts":
        'export { db } from "../../../packages/db/query";',
      "packages/db/query.ts": "export const db = {};",
    },
    (root) => assert(checkWebDatabaseBoundary(root).length > 0),
  );
  fixture(
    {
      "apps/web/src/server/load.ts":
        'import "server-only"; export const load = () => fetch("http://api/v1/formations");',
    },
    (root) => assert.deepEqual(checkWebDatabaseBoundary(root), []),
  );
});

test("rejects dynamic and computed database imports", () => {
  fixture(
    {
      "apps/web/src/card.tsx":
        '"use client"; const a = import("pg"); const b = import(name);',
    },
    (root) => assert.equal(checkClientBoundaries(root).length, 2),
  );
});

test("allows server imports and client type-only imports", () => {
  fixture(
    {
      "apps/web/src/page.tsx": 'import { query } from "./server/db";',
      "apps/web/src/card.tsx":
        '"use client"; import type { Value } from "./server/db";',
      "apps/web/src/server/db.ts":
        "export type Value = string; export const query = () => 1;",
    },
    (root) => assert.deepEqual(checkClientBoundaries(root), []),
  );
});

test("rejects I/O dependencies in the pure Rust domain", () => {
  assert.equal(
    checkDomainDependencies([
      { name: "orvio-core", dependencies: [{ name: "sqlx" }] },
    ]).length,
    1,
  );
  assert.deepEqual(
    checkDomainDependencies([
      { name: "orvio-core", dependencies: [{ name: "serde" }] },
    ]),
    [],
  );
});
