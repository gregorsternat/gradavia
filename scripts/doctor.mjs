import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tools = [
  ["node", ["--version"], `v${readFileSync(".node-version", "utf8").trim()}`],
  [
    "pnpm",
    ["--version"],
    JSON.parse(readFileSync("package.json", "utf8"))
      .packageManager.split("@")
      .at(-1),
  ],
  ["rustc", ["--version"], "rustc 1.98.1"],
  ["just", ["--version"], "just 1.58.0"],
];

for (const [tool, args, expected] of tools) {
  try {
    const version = execFileSync(tool, args, { encoding: "utf8" }).trim();
    if (!version.startsWith(expected)) throw new Error("version mismatch");
    console.log(JSON.stringify({ tool, status: "ready", version }));
  } catch {
    console.error(
      JSON.stringify({
        tool,
        status: "unavailable",
        expected,
        fix: "Run mise install and use mise exec -- just doctor; install Rust with rustup.",
      }),
    );
    process.exitCode = 1;
  }
}

try {
  execFileSync("docker", ["info", "--format", "{{.ServerVersion}}"], {
    stdio: "pipe",
  });
  console.log(JSON.stringify({ tool: "docker", status: "ready" }));
} catch {
  console.log(
    JSON.stringify({
      tool: "docker",
      status: "optional",
      note: "Start Docker for just test-db, or supply TEST_DATABASE_URL for local PostgreSQL 18.",
    }),
  );
}
