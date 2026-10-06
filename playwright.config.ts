import { defineConfig, devices } from "@playwright/test";

const production = process.env.E2E_PRODUCTION === "1";
const port = process.env.E2E_PORT ?? (production ? "3101" : "3100");
const baseURL = `http://127.0.0.1:${port}`;
const scenario = process.env.E2E_STATE ? `-${process.env.E2E_STATE}` : "";
const artifacts = `${process.env.ARTIFACTS_DIR ?? ".artifacts"}/${production ? "browser-production" : "browser-development"}${scenario}`;

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: process.env.E2E_STATE
    ? "**/explorer-state.spec.ts"
    : "**/{shell,landing,formations,observatory,specialties,selections,atlas,analysis,budget,evolutions,seo}.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  // Development routes compile on first navigation; production stays at 5s.
  expect: { timeout: production ? 5_000 : 15_000 },
  outputDir: `${artifacts}/results`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${artifacts}/report`, open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm exec tsx scripts/e2e-server.ts",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 90_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 30_000 },
  },
});
