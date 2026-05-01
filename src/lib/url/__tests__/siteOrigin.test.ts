import assert from "node:assert/strict";
import test from "node:test";
import { siteOriginFromRequestUrl } from "@/lib/url/siteOrigin";

test("siteOriginFromRequestUrl prefers configured public origin", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.tripcrew.app/path";

  try {
    assert.equal(
      siteOriginFromRequestUrl("https://attacker.example/api/applications/a/checkout"),
      "https://example.tripcrew.app",
    );
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test("siteOriginFromRequestUrl does not trust request host outside development", () => {
  const previousOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  const mutableEnv = process.env as Record<string, string | undefined>;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  mutableEnv.NODE_ENV = "production";

  try {
    assert.equal(
      siteOriginFromRequestUrl("https://attacker.example/api/applications/a/checkout"),
      "https://tripcrew.app",
    );
  } finally {
    if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = previousOrigin;
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
  }
});
