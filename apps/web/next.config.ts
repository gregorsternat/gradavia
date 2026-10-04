import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www\\.gradavia\\.com" }],
        destination: "https://gradavia.com/:path*",
        permanent: true,
      },
    ];
  },
};

export default config;
