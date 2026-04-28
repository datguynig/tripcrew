import { createHash } from "node:crypto";

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("IP_HASH_SALT not configured");
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

export function buildCacheKey(slug: string, normalizedInputs: string): string {
  return createHash("sha256")
    .update(`${slug}:${normalizedInputs}`)
    .digest("hex");
}
