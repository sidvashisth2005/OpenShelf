import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here is per-user (sessions, admin views, private content), so we
  // keep the classic dynamic rendering model instead of Cache Components to rule
  // out user data ever landing in a shared cache.
  cacheComponents: false,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite", "pg", "bcryptjs"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          // CSP (per-request nonce) and HSTS are set in src/proxy.ts.
        ],
      },
    ];
  },
};

export default nextConfig;
