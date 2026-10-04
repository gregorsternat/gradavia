import { Container } from "@cloudflare/containers";
import { proxyApiRequest } from "./proxy";

export class GradaviaApi extends Container<Cloudflare.Env> {
  defaultPort = 3002;
  sleepAfter = "10m";
  enableInternet = true;
  pingEndpoint = "localhost/health/live";
  envVars = {
    API_BIND: "0.0.0.0:3002",
    DATABASE_URL: this.env.DATABASE_URL,
  };

  override onError(): never {
    // The SDK error can contain runtime configuration; never log it.
    throw new Error("API container unavailable");
  }
}

export default {
  fetch(request, env) {
    return proxyApiRequest(request, (forwarded) =>
      env.API_CONTAINER.getByName("api").fetch(forwarded),
    );
  },
} satisfies ExportedHandler<Cloudflare.Env>;
