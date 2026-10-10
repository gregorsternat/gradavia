/** Stable publication identity; transport cache-busters are never page state. */
export function pageIdentity(value: string) {
  const url = new URL(value, "https://gradavia.com");
  const detail = url.pathname.match(/^\/(formations|atlas)\/([^/]+)$/);
  if (detail) {
    // Next detail routes derive their source and campaign from the ID alone.
    url.search = "";
    try {
      const id = decodeURIComponent(detail[2]!);
      if (/^[a-f0-9-]{36}:[1-9]\d*$/i.test(id))
        url.pathname = `/${detail[1]}/${encodeURIComponent(id.toLowerCase())}`;
    } catch {
      // Malformed route encodings keep their missing-page behavior.
    }
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key === "_rsc" || /^(utm_|gclid$|fbclid$|msclkid$)/.test(key))
      url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.pathname + (url.searchParams.size ? `?${url.searchParams}` : "");
}
export async function pageAsset(value: string, rsc: boolean) {
  const bytes = new TextEncoder().encode(pageIdentity(value));
  const sum = await crypto.subtle.digest("SHA-256", bytes);
  const key = Array.from(new Uint8Array(sum), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `pages/${key}.${rsc ? "rsc" : "html"}`;
}
