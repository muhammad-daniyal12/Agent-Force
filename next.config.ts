import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Appwrite Sites SSR requires a deployable Node.js server bundle.
  output: "standalone",
  // OAuth callbacks contain a one-use secret; exclude their URL from dev logs.
  logging: {
    incomingRequests: { ignore: [/\/api\/auth\/google\/callback(?:\?|$)/] },
  },
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
