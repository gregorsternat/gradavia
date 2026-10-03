import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Drizzle alone owns these tables. Rust writes through the generated migration.
export const sourceDatasets = pgTable(
  "source_datasets",
  {
    id: text("id").primaryKey(),
    family: text("family").notNull(),
    provider: text("provider").notNull(),
    archived: boolean("archived").notNull(),
    currentReleaseId: uuid("current_release_id").references(
      (): AnyPgColumn => sourceReleases.id,
    ),
  },
  (table) => [
    foreignKey({
      name: "source_datasets_current_release_dataset_fk",
      columns: [table.id, table.currentReleaseId],
      foreignColumns: [sourceReleases.datasetId, sourceReleases.id],
    }),
  ],
);

export const sourceReleases = pgTable(
  "source_releases",
  {
    id: uuid("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references((): AnyPgColumn => sourceDatasets.id),
    fingerprint: text("fingerprint").notNull(),
    contractVersion: integer("contract_version").notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull(),
    sourceModifiedAt: timestamp("source_modified_at", { withTimezone: true }),
    importerVersion: text("importer_version").notNull(),
    license: text("license").notNull(),
    metadata: jsonb("metadata").notNull(),
    manifest: jsonb("manifest").notNull(),
    manifestPath: text("manifest_path").notNull(),
    rowCount: bigint("row_count", { mode: "number" }).notNull(),
    dataBytes: bigint("data_bytes", { mode: "number" }).notNull(),
    campaigns: jsonb("campaigns").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("source_releases_content_unique").on(
      table.datasetId,
      table.fingerprint,
    ),
    unique("source_releases_dataset_id_unique").on(table.datasetId, table.id),
    check("source_releases_rows_positive", sql`${table.rowCount} > 0`),
    check("source_releases_bytes_positive", sql`${table.dataBytes} > 0`),
    check(
      "source_releases_sha256",
      sql`${table.fingerprint} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const rawRecords = pgTable(
  "raw_records",
  {
    releaseId: uuid("release_id")
      .notNull()
      .references(() => sourceReleases.id),
    rowNumber: bigint("row_number", { mode: "number" }).notNull(),
    campaign: integer("campaign").notNull(),
    establishmentId: text("establishment_id"),
    formationId: text("formation_id"),
    payload: jsonb("payload").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.rowNumber] }),
    index("raw_records_campaign_idx").on(table.releaseId, table.campaign),
    index("raw_records_establishment_idx")
      .on(table.campaign, table.establishmentId)
      .where(sql`${table.establishmentId} IS NOT NULL`),
    index("raw_records_formation_idx")
      .on(table.campaign, table.formationId)
      .where(sql`${table.formationId} IS NOT NULL`),
    check("raw_records_row_positive", sql`${table.rowNumber} > 0`),
    check(
      "raw_records_campaign_valid",
      sql`${table.campaign} BETWEEN 1900 AND 2200`,
    ),
    check("raw_records_object", sql`jsonb_typeof(${table.payload}) = 'object'`),
  ],
);

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => sourceDatasets.id),
    releaseId: uuid("release_id").references(() => sourceReleases.id),
    mode: text("mode").notNull(),
    status: text("status").notNull(),
    importerVersion: text("importer_version").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    rowCount: bigint("row_count", { mode: "number" }).default(0).notNull(),
    rejectedCount: bigint("rejected_count", { mode: "number" })
      .default(0)
      .notNull(),
    dataBytes: bigint("data_bytes", { mode: "number" }).default(0).notNull(),
    manifestPath: text("manifest_path"),
    diagnostic: jsonb("diagnostic"),
  },
  (table) => [
    index("ingestion_runs_dataset_started_idx").on(
      table.datasetId,
      table.startedAt,
    ),
    check("ingestion_runs_mode", sql`${table.mode} IN ('sync', 'replay')`),
    check(
      "ingestion_runs_status",
      sql`${table.status} IN ('running', 'published', 'unchanged', 'retained', 'failed', 'interrupted')`,
    ),
    check(
      "ingestion_runs_counts",
      sql`${table.rowCount} >= 0 AND ${table.rejectedCount} >= 0 AND ${table.dataBytes} >= 0`,
    ),
  ],
);
