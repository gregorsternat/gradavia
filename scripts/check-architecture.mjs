import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory()
      ? sourceFiles(file)
      : /\.[cm]?[jt]sx?$/.test(file)
        ? [file]
        : [];
  });
}

function imports(source) {
  const values = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      const bindings = node.importClause?.namedBindings;
      const onlyTypes =
        !node.importClause?.name &&
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.length > 0 &&
        bindings.elements.every((entry) => entry.isTypeOnly);
      if (!onlyTypes) values.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      !node.isTypeOnly
    )
      values.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(source) === "require")
    ) {
      const argument = node.arguments[0];
      values.push(
        argument && ts.isStringLiteralLike(argument)
          ? argument.text
          : "<computed-import>",
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return values;
}

export function checkClientBoundaries(root) {
  const configPath = path.join(root, "apps/web/tsconfig.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error)
    throw new Error("Cannot read the web TypeScript configuration");
  const config = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(configPath),
  );
  const files = sourceFiles(path.join(root, "apps/web/src"));
  const cache = new Map();
  const failures = [];
  function parse(file) {
    if (!cache.has(file))
      cache.set(
        file,
        ts.createSourceFile(
          file,
          readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
        ),
      );
    return cache.get(file);
  }
  const forbidden = (value) =>
    /(^|\/)(server|packages\/db)(\/|$)|\.server\.[jt]sx?$/.test(value) ||
    [
      "server-only",
      "pg",
      "postgres",
      "drizzle-orm",
      "@neondatabase",
      "@orvio/db",
    ].some((prefix) => value === prefix || value.startsWith(`${prefix}/`));
  for (const file of files) {
    const source = parse(file);
    const client = source.statements.some(
      (node) =>
        ts.isExpressionStatement(node) &&
        ts.isStringLiteral(node.expression) &&
        node.expression.text === "use client",
    );
    if (!client) continue;
    const seen = new Set();
    function walk(current, chain) {
      if (seen.has(current)) return;
      seen.add(current);
      for (const specifier of imports(parse(current))) {
        const resolved = ts.resolveModuleName(
          specifier,
          current,
          config.options,
          ts.sys,
        ).resolvedModule?.resolvedFileName;
        if (
          specifier === "<computed-import>" ||
          forbidden(specifier) ||
          (resolved && forbidden(path.relative(root, resolved)))
        ) {
          failures.push(
            `${chain.join(" -> ")} -> ${specifier}: move database/server access into a server module and pass serializable props to the client.`,
          );
        } else if (
          resolved &&
          !resolved.includes("node_modules") &&
          existsSync(resolved)
        ) {
          walk(resolved, [...chain, path.relative(root, resolved)]);
        }
      }
    }
    walk(file, [path.relative(root, file)]);
  }
  return failures;
}

export function checkDomainDependencies(packages) {
  const domain = packages.find((entry) => entry.name === "orvio-core");
  if (!domain) return ["Missing orvio-core domain crate"];
  return domain.dependencies
    .filter((dependency) => !["serde", "thiserror"].includes(dependency.name))
    .map(
      (dependency) =>
        `orvio-core -> ${dependency.name}: keep I/O and runtime dependencies in orvio-aggregator.`,
    );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = process.cwd();
  const metadata = JSON.parse(
    execFileSync(
      "cargo",
      ["metadata", "--no-deps", "--format-version", "1", "--locked"],
      { cwd: root, encoding: "utf8" },
    ),
  );
  const failures = [
    ...checkClientBoundaries(root),
    ...checkDomainDependencies(metadata.packages),
  ];
  failures.forEach((failure) => console.error(failure));
  if (failures.length) process.exitCode = 1;
  else
    console.log(
      "Architecture boundaries passed (transitive client imports and Rust domain dependencies).",
    );
}
