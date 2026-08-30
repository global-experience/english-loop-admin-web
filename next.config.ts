import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_ORIGIN?.replace(/\/$/, "");
    if (!apiOrigin) return [];
    return [{ source: "/backend/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
