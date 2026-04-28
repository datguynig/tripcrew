import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DRAFT_COOKIE_NAME,
  draftCookieOptions,
} from "@/lib/teaser/cookieConfig";
import type { DraftLead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");

  if (!id || !token || !slug || !/^[a-z0-9-]+$/.test(slug)) {
    return new NextResponse("Bad parameters", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("draft_leads")
    .select("id")
    .eq("id", id)
    .eq("resume_token", token)
    .eq("slug", slug)
    .maybeSingle<Pick<DraftLead, "id">>();

  if (error || !data) {
    const target = new URL(`/curated/${slug}`, request.url);
    return NextResponse.redirect(target, 302);
  }

  const target = new URL(`/curated/${slug}`, request.url);
  const response = NextResponse.redirect(target, 302);
  response.cookies.set(DRAFT_COOKIE_NAME, data.id, draftCookieOptions());
  return response;
}
