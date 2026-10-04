import { describe, expect, it, vi } from "vitest";
import { proxyApiRequest } from "./proxy";

describe("private Rust API proxy", () => {
  it("rejects writes and unrelated paths before starting a container", async () => {
    const forward = vi.fn();
    const write = await proxyApiRequest(
      new Request("https://api/v1/formations", { method: "POST" }),
      forward,
    );
    const unrelated = await proxyApiRequest(
      new Request("https://api/admin"),
      forward,
    );
    expect(write.status).toBe(405);
    expect(write.headers.get("allow")).toBe("GET, HEAD");
    expect(unrelated.status).toBe(404);
    expect(forward).not.toHaveBeenCalled();
  });

  it("preserves the query and streamed response while removing caller credentials", async () => {
    const upstream = new Response("source data", {
      headers: { "Cache-Control": "no-store" },
    });
    const forward = vi.fn(async (request: Request) => {
      expect(request.url).toBe(
        "http://container/v1/formations?q=%C3%A9cole+paris&campagne=2025",
      );
      expect(request.headers.get("authorization")).toBeNull();
      expect(request.headers.get("cookie")).toBeNull();
      expect(request.headers.get("host")).toBeNull();
      return upstream;
    });
    const result = await proxyApiRequest(
      new Request(
        "https://api/v1/formations?q=%C3%A9cole+paris&campagne=2025",
        { headers: { Authorization: "secret", Cookie: "session=secret" } },
      ),
      forward,
    );
    expect(result).toBe(upstream);
    expect(result.bodyUsed).toBe(false);
    expect(result.headers.get("cache-control")).toBe("no-store");
  });

  it("preserves HEAD health requests", async () => {
    const forward = vi.fn(async (request: Request) => {
      expect(request.method).toBe("HEAD");
      expect(request.url).toBe("http://container/health/live");
      return new Response(null);
    });
    const response = await proxyApiRequest(
      new Request("https://api/health/live", { method: "HEAD" }),
      forward,
    );
    expect(response.status).toBe(200);
    expect(forward).toHaveBeenCalledOnce();
  });

  it("does not expose runtime errors and marks failures as retryable and uncached", async () => {
    const response = await proxyApiRequest(
      new Request("https://api/v1/sources"),
      async () => {
        throw new Error("postgres://user:secret@database/gradavia");
      },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("sanitizes SDK startup responses without returning their body", async () => {
    const response = await proxyApiRequest(
      new Request("https://api/v1/sources"),
      async () =>
        new Response("Failed to start container: private details", {
          status: 500,
        }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: { code: "unavailable" } });
  });

  it("does not start a container for an already-cancelled request", async () => {
    const forward = vi.fn();
    const response = await proxyApiRequest(
      new Request("https://api/v1/sources", { signal: AbortSignal.abort() }),
      forward,
    );
    expect(response.status).toBe(503);
    expect(forward).not.toHaveBeenCalled();
  });

  it("cancels upstream work when the caller stops waiting", async () => {
    const caller = new AbortController();
    const response = proxyApiRequest(
      new Request("https://api/v1/sources", { signal: caller.signal }),
      (request) =>
        new Promise((_, reject) => {
          request.signal.addEventListener(
            "abort",
            () => reject(request.signal.reason),
            {
              once: true,
            },
          );
        }),
    );
    caller.abort();
    expect((await response).status).toBe(503);
  });
});
