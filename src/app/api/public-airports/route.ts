import { NextResponse } from "next/server";
import { searchPublicAirports } from "@/lib/airports/publicSearch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  try {
    const result = await searchPublicAirports({ query });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("public airport search failed", err);
    return NextResponse.json(
      { results: [], error: "Airport search unavailable." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
