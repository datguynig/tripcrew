import { NextResponse, type NextRequest } from "next/server";
import { DRAFT_COOKIE_NAME } from "@/lib/teaser/cookieConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Clears the curated-teaser draft cookie, then 302s back to the curated
 * trip page so the visitor sees the gate view. Lives as a Route Handler
 * because Next.js 16 forbids cookie mutations inside Server Components,
 * which is where the page render lives.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new NextResponse("Bad slug", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const target = new URL(`/curated/${slug}`, request.url);
  const response = NextResponse.redirect(target, 302);
  response.cookies.delete(DRAFT_COOKIE_NAME);
  return response;
}
