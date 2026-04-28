import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeDraftLead } from "@/lib/actions/teaser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  if (!id || !token) {
    return new NextResponse("Missing id or token.", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const result = await unsubscribeDraftLead(id, token);
  if (!result.ok) {
    return new NextResponse("Could not unsubscribe. Please try again later.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(
    "You're unsubscribed. We won't email you about this draft again.",
    {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}
