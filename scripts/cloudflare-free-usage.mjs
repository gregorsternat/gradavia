import { mkdir, writeFile } from "node:fs/promises";
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!token) throw new Error("Cloudflare read token required");
const account = "aa772cd6962f92be034156b7855f6d62";
const now = new Date(),
  from = new Date(now.getTime() - 24 * 3600_000);
const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    query: `query Usage($account: String!, $from: DateTime!, $to: DateTime!) { viewer { accounts(filter: {accountTag: $account}) { workersInvocationsAdaptive(limit: 10000, filter: {datetime_geq: $from, datetime_leq: $to}) { sum { requests errors } dimensions { scriptName } } } } }`,
    variables: { account, from: from.toISOString(), to: now.toISOString() },
  }),
});
const result = await response.json();
if (
  !response.ok ||
  result.errors?.length ||
  !result.data?.viewer?.accounts?.[0]
)
  throw new Error(
    "Cloudflare usage unavailable; check Account Analytics Read permission",
  );
const workers = result.data.viewer.accounts[0].workersInvocationsAdaptive;
if (!Array.isArray(workers) || workers.length >= 10000)
  throw new Error("Usage result missing or truncated");
if (
  workers.some(
    (row) => !Number.isFinite(row.sum?.requests) || row.sum.requests < 0,
  )
)
  throw new Error("Invalid usage measurement");
const requests = workers.reduce((sum, row) => sum + row.sum.requests, 0);
await mkdir(".artifacts/cloudflare", { recursive: true });
await writeFile(
  ".artifacts/cloudflare/usage.json",
  JSON.stringify({ measuredAt: now.toISOString(), requests, workers }, null, 2),
);
console.log(
  `Account Worker invocations in the last 24 hours: ${requests}/100000. No plan changes were made.`,
);
if (requests >= 80000)
  throw new Error(
    "Cloudflare Free request margin is below 20%; inspect usage before the hard account limit",
  );
