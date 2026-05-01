import { headers } from "next/headers";

const PRODUCTION_FALLBACK_ORIGIN = "https://tripcrew.app";

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

export function configuredSiteOrigin(): string | null {
  return normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
}

export function siteOriginFromRequestUrl(requestUrl: string): string {
  const configured = configuredSiteOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") {
    return new URL(requestUrl).origin;
  }
  return PRODUCTION_FALLBACK_ORIGIN;
}

export async function siteOriginFromHeaders(): Promise<string> {
  const configured = configuredSiteOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "development") return PRODUCTION_FALLBACK_ORIGIN;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
