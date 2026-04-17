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
  experimental: {
    serverActions: {
      allowedOrigins: devOrigins,
    },
  },
};

export default nextConfig;
