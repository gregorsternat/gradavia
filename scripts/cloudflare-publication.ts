import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  prepareDeployment,
  type Release,
} from "./prepare-cloudflare-publication";
import { validatePublication } from "./publication-assets";

export type Evidence = {
  releaseId: string;
  measuredAt: string;
  cloudflare: {
    coldSamples: number;
    warmSamples: number;
    cpuP99Ms: number;
    maxMemoryMiB: number;
    resourceLimitErrors: number;
    requestsLast24Hours: number;
    workersOnAccount: number;
  };
  browser: {
    desktop: boolean;
    mobile: boolean;
    noJavaScript: boolean;
    lcpMs: number;
    cls: number;
    interactionP95Ms: number;
    slowJourneyP95BeforeMs: number;
    slowJourneyP95AfterMs: number;
  };
};
export function checkEvidence(
  release: Release,
  evidence: Evidence,
  now = Date.now(),
) {
  const cf = evidence.cloudflare,
    browser = evidence.browser;
  const age = now - Date.parse(evidence.measuredAt);
  if (
    evidence.releaseId !== release.id ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 24 * 3600_000
  )
    throw new Error(
      "Evidence is stale or belongs to another immutable release",
    );
  const measurements = [
    cf.coldSamples,
    cf.warmSamples,
    cf.cpuP99Ms,
    cf.maxMemoryMiB,
    cf.resourceLimitErrors,
    cf.requestsLast24Hours,
    cf.workersOnAccount,
    browser.lcpMs,
    browser.cls,
    browser.interactionP95Ms,
    browser.slowJourneyP95BeforeMs,
    browser.slowJourneyP95AfterMs,
  ];
  if (measurements.some((v) => !Number.isFinite(v) || v < 0))
    throw new Error("Missing measurement");
  if (
    cf.coldSamples < 100 ||
    cf.warmSamples < 100 ||
    cf.cpuP99Ms >= 8 ||
    cf.maxMemoryMiB >= 128 ||
    cf.resourceLimitErrors !== 0 ||
    cf.requestsLast24Hours >= 80_000 ||
    cf.workersOnAccount + release.shards.length + 3 > 90
  )
    throw new Error("Cloudflare Free safety margin not demonstrated");
  if (
    !browser.desktop ||
    !browser.mobile ||
    !browser.noJavaScript ||
    browser.lcpMs > 2500 ||
    browser.cls > 0.1 ||
    browser.interactionP95Ms > 200 ||
    browser.slowJourneyP95BeforeMs <= 0 ||
    browser.slowJourneyP95AfterMs > browser.slowJourneyP95BeforeMs * 0.5
  )
    throw new Error(
      "Browser parity or performance acceptance not demonstrated",
    );
}
async function wrangler(config: string, dryRun: boolean) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "--filter",
        "@gradavia/free-web",
        "exec",
        "wrangler",
        "deploy",
        "--config",
        config,
        ...(dryRun ? ["--dry-run"] : []),
      ],
      { stdio: "inherit" },
    );
    child.once("error", () => reject(new Error("Wrangler unavailable")));
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Publication deployment failed; production pointer unchanged unless gateway deployment completed",
            ),
          ),
    );
  });
}
if (process.argv[1]?.endsWith("cloudflare-publication.ts")) {
  const [mode, directory, evidencePath, previousPath] = process.argv.slice(2);
  if (
    !["check", "stage", "activate", "rollback"].includes(mode ?? "") ||
    !directory
  )
    throw new Error(
      "Usage: cloudflare-publication.ts check|stage|activate|rollback <packed-directory> [evidence] [previous-release.json]",
    );
  const root = resolve(directory);
  await validatePublication(join(root, "archive"));
  const previous = previousPath
    ? (JSON.parse(await readFile(previousPath, "utf8")) as Release)
    : undefined;
  const deployment = await prepareDeployment(root, previous);
  if (mode === "check") {
    for (const config of [...deployment.stage, deployment.gateway])
      await wrangler(config, true);
  } else if (mode === "stage") {
    // Upload private, versioned services only. No production routes move here.
    for (const config of deployment.stage) await wrangler(config, false);
  } else {
    if (!evidencePath)
      throw new Error(
        "Verified Cloudflare and browser evidence is required before activation",
      );
    const supplied = JSON.parse(await readFile(evidencePath, "utf8"));
    const evidence: Evidence =
      mode === "rollback" ? supplied.evidence : supplied;
    if (
      mode === "rollback" &&
      (supplied.id !== deployment.release.id ||
        !Number.isFinite(Date.parse(supplied.activatedAt)))
    )
      throw new Error(
        "Rollback requires this release's saved successful activation receipt",
      );
    // Rollback restores an already measured deployment. Requiring a new cold
    // benchmark during an incident would prevent restoring the previous version.
    checkEvidence(
      deployment.release,
      evidence,
      mode === "rollback" ? Date.parse(evidence.measuredAt) : Date.now(),
    );
    // This single binding deployment switches HTML, data, API and navigation together.
    await wrangler(deployment.gateway, false);
    await writeFile(
      join(root, "activated.json"),
      JSON.stringify(
        {
          ...deployment.release,
          activatedAt: new Date().toISOString(),
          evidence,
        },
        null,
        2,
      ),
    );
  }
}
