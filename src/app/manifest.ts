import type { MetadataRoute } from "next";

// Lets owners install AgentForce on their phone or desktop and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgentForce · AI Digital Employees",
    short_name: "AgentForce",
    description: "AI agents that handle support, inventory and sales, with the owner approving every reply.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f9",
    theme_color: "#059669",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New customer request", url: "/operations" },
      { name: "Approval Center", url: "/approvals" },
    ],
  };
}
