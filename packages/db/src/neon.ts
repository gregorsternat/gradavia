import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { validateDatabaseUrl } from "./config";
import * as schema from "./schema";

// Create the timeout for each request, not when a long-lived client is created.
neonConfig.fetchFunction = (input: RequestInfo | URL, init?: RequestInit) => {
  const timeout = AbortSignal.timeout(15_000);
  return fetch(input, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
};

export function createNeonDatabase(connectionString: string) {
  const query = neon(validateDatabaseUrl(connectionString));
  return drizzle({ client: query, schema });
}
