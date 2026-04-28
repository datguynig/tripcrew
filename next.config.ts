import type { NextConfig } from "next";

const codespaceName = process.env.CODESPACE_NAME;
const forwardingDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";

const codespaceHost = codespaceName
  ? `${codespaceName}-3000.${forwardingDomain}`
  : null;

const devOrigins = [
  ...(codespaceHost ? [codespaceHost] : []),
  `*.${forwardingDomain}`,
  "localhost:3000",
  "localhost",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      allowedOrigins: devOrigins,
    },
    // Disable the client-side Router Cache so HMR-updated server
    // components show on soft navigation. Without this Next caches
    // RSC payloads (dynamic 30s, static 5m) and the browser serves
    // the stale payload until a hard reload.
    staleTimes: {
      dynamic: 0,
      static: 30,
    },
  },
};

export default nextConfig;
