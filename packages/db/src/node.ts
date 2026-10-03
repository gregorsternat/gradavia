import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { validateDatabaseUrl } from "./config";
import * as schema from "./schema";

export function createNodeClient(connectionString: string) {
  const client = new pg.Client({
    connectionString: validateDatabaseUrl(connectionString),
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
  });
  return { client, db: drizzle({ client, schema }) };
}
