import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { validateDatabaseUrl } from "./src/config";

config({ path: "../../.env.local", quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  // Generation is offline. Only commands that connect need credentials.
  ...(process.env.DATABASE_URL_UNPOOLED
    ? {
        dbCredentials: {
          url: validateDatabaseUrl(process.env.DATABASE_URL_UNPOOLED, true),
        },
      }
    : {}),
});
