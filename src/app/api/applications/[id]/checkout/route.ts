import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { siteOriginFromRequestUrl } from "@/lib/url/siteOrigin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Interval = "monthly" | "annual";

function parseInterval(request: Request): Interval {
  const value = new URL(request.url).searchParams.get("interval");
  return value === "annual" ? "annual" : "monthly";
}

function resolvePriceId(interval: Interval): string | null {
  if (interval === "annual") {
    return process.env.STRIPE_PRICE_ID_ANNUAL ?? null;
  }
  return process.env.STRIPE_PRICE_ID ?? null;
}

function siteOrigin(request: Request): string {
  return siteOriginFromRequestUrl(request.url);
}

type ApplicationRow = {
  id: string;
  email: string;
  approved_at: string | null;
  draft_lead_id: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing application id." }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: application, error } = await supabase
    .from("applications")
    .select("id, email, approved_at, draft_lead_id")
    .eq("id", id)
    .maybeSingle<ApplicationRow>();

  if (error) {
    console.error("crew-plus checkout: application lookup failed", error);
    return NextResponse.json(
      { error: "Could not load your application. Try again." },
      { status: 500 },
    );
  }
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (!application.approved_at) {
    return NextResponse.json(
      { error: "Application not approved." },
      { status: 400 },
    );
  }

  const origin = siteOrigin(request);
  const interval = parseInterval(request);
  const priceId = resolvePriceId(interval);
  if (!priceId) {
    const envVar =
      interval === "annual" ? "STRIPE_PRICE_ID_ANNUAL" : "STRIPE_PRICE_ID";
    console.error(`crew-plus checkout: ${envVar} is unset`);
    return NextResponse.json(
      { error: "Crew Plus checkout is not configured." },
      { status: 500 },
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: application.email,
      line_items: [{ price: priceId, quantity: 1 }],
      // Match the Phase 2 founding-checkout pattern: land on /sign-in,
      // not a (non-existent) /welcome route. The webhook provisions the
      // profile + first trip and fires a magic link in parallel.
      success_url: `${origin}/sign-in?from=crew-plus-checkout&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/`,
      metadata: {
        kind: "crew_plus",
        interval,
        application_id: application.id,
        draft_lead_id: application.draft_lead_id ?? "",
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe didn't return a checkout URL." },
        { status: 500 },
      );
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("crew-plus checkout: session.create failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
