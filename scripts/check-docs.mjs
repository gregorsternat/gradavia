import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const required = [
  "README.md",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/index.md",
  "docs/product.md",
  "docs/development.md",
  "docs/design-system.md",
  "docs/data-contract.md",
  "docs/quality.md",
  "docs/decisions.md",
  "docs/exec-plans/index.md",
  "docs/exec-plans/tech-debt.md",
];
const failures = [];
for (const file of required)
  if (!existsSync(file))
    failures.push(`Missing ${file}; restore the documented entry point.`);

function markdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? markdownFiles(file)
      : file.endsWith(".md")
        ? [file]
        : [];
  });
}

const files = [
  ...new Set([...required.filter(existsSync), ...markdownFiles("docs")]),
];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!existsSync(resolved))
      failures.push(
        `${file}: broken link ${target}; update the link or restore its target.`,
      );
  }
}
if (
  existsSync("AGENTS.md") &&
  readFileSync("AGENTS.md", "utf8").split("\n").length > 110
)
  failures.push(
    "AGENTS.md exceeds 110 lines; move detailed guidance to the linked documentation.",
  );
const index = existsSync("docs/index.md")
  ? readFileSync("docs/index.md", "utf8")
  : "";
for (const file of markdownFiles("docs").filter(
  (file) => path.dirname(file) === "docs" && path.basename(file) !== "index.md",
)) {
  if (!index.includes(`(${path.basename(file)})`))
    failures.push(`${file} is missing from docs/index.md.`);
}

failures.forEach((failure) => console.error(failure));
if (failures.length) process.exitCode = 1;
else
  console.log(
    "Documentation entry points and local links passed. Semantic accuracy still requires review.",
  );
