import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Enables unauthorized() / forbidden() and their unauthorized.tsx / forbidden.tsx UI.
    authInterrupts: true,
  },
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
