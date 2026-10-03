CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"release_id" uuid,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"importer_version" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"row_count" bigint DEFAULT 0 NOT NULL,
	"rejected_count" bigint DEFAULT 0 NOT NULL,
	"data_bytes" bigint DEFAULT 0 NOT NULL,
	"manifest_path" text,
	"diagnostic" jsonb,
	CONSTRAINT "ingestion_runs_mode" CHECK ("ingestion_runs"."mode" IN ('sync', 'replay')),
	CONSTRAINT "ingestion_runs_status" CHECK ("ingestion_runs"."status" IN ('running', 'published', 'unchanged', 'retained', 'failed', 'interrupted')),
	CONSTRAINT "ingestion_runs_counts" CHECK ("ingestion_runs"."row_count" >= 0 AND "ingestion_runs"."rejected_count" >= 0 AND "ingestion_runs"."data_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "raw_records" (
	"release_id" uuid NOT NULL,
	"row_number" bigint NOT NULL,
	"campaign" integer NOT NULL,
	"establishment_id" text,
	"formation_id" text,
	"payload" jsonb NOT NULL,
	CONSTRAINT "raw_records_release_id_row_number_pk" PRIMARY KEY("release_id","row_number"),
	CONSTRAINT "raw_records_row_positive" CHECK ("raw_records"."row_number" > 0),
	CONSTRAINT "raw_records_campaign_valid" CHECK ("raw_records"."campaign" BETWEEN 1900 AND 2200),
	CONSTRAINT "raw_records_object" CHECK (jsonb_typeof("raw_records"."payload") = 'object')
);
--> statement-breakpoint
CREATE TABLE "source_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"family" text NOT NULL,
	"provider" text NOT NULL,
	"archived" boolean NOT NULL,
	"current_release_id" uuid
);
--> statement-breakpoint
CREATE TABLE "source_releases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"contract_version" integer NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"source_modified_at" timestamp with time zone,
	"importer_version" text NOT NULL,
	"license" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"manifest" jsonb NOT NULL,
	"manifest_path" text NOT NULL,
	"row_count" bigint NOT NULL,
	"data_bytes" bigint NOT NULL,
	"campaigns" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_releases_content_unique" UNIQUE("dataset_id","fingerprint"),
	CONSTRAINT "source_releases_dataset_id_unique" UNIQUE("dataset_id","id"),
	CONSTRAINT "source_releases_rows_positive" CHECK ("source_releases"."row_count" > 0),
	CONSTRAINT "source_releases_bytes_positive" CHECK ("source_releases"."data_bytes" > 0),
	CONSTRAINT "source_releases_sha256" CHECK ("source_releases"."fingerprint" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_dataset_id_source_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."source_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_release_id_source_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."source_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_release_id_source_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."source_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_datasets" ADD CONSTRAINT "source_datasets_current_release_id_source_releases_id_fk" FOREIGN KEY ("current_release_id") REFERENCES "public"."source_releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_datasets" ADD CONSTRAINT "source_datasets_current_release_dataset_fk" FOREIGN KEY ("id","current_release_id") REFERENCES "public"."source_releases"("dataset_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_releases" ADD CONSTRAINT "source_releases_dataset_id_source_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."source_datasets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_dataset_started_idx" ON "ingestion_runs" USING btree ("dataset_id","started_at");--> statement-breakpoint
CREATE INDEX "raw_records_campaign_idx" ON "raw_records" USING btree ("release_id","campaign");--> statement-breakpoint
CREATE INDEX "raw_records_establishment_idx" ON "raw_records" USING btree ("campaign","establishment_id") WHERE "raw_records"."establishment_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "raw_records_formation_idx" ON "raw_records" USING btree ("campaign","formation_id") WHERE "raw_records"."formation_id" IS NOT NULL;