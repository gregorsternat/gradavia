export function validateDatabaseUrl(
  value: string | undefined,
  direct = false,
): string {
  const message = direct
    ? "A direct PostgreSQL connection URL with a database name is required"
    : "A PostgreSQL connection URL with a database name is required";
  try {
    const url = new URL(value ?? "");
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname.replaceAll("/", "") ||
      (direct && url.hostname.includes("-pooler."))
    ) {
      throw new Error(message);
    }
    return value!;
  } catch {
    // Do not retain URL parser errors: they include the input and its password.
    throw new Error(message);
  }
}
