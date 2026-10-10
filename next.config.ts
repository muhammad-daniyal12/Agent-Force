import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Appwrite Sites SSR requires a deployable Node.js server bundle.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
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
