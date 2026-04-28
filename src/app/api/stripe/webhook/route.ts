import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe/server";
import {
  createFirstTripFromDraft,
  provisionProfileForCheckout,
  sendMagicLink,
} from "@/lib/auth/checkoutProvisioning";
import type { DraftLead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AllowedStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

function coerceStatus(stripeStatus: Stripe.Subscription.Status): AllowedStatus {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
      return "incomplete";
    case "canceled":
    case "incomplete_expired":
    case "paused":
    default:
      return "canceled";
  }
}

function periodEndIso(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0] as
    | (Stripe.SubscriptionItem & { current_period_end?: number })
    | undefined;
  const fromItem = item?.current_period_end;
  const fromSub = (sub as Stripe.Subscription & { current_period_end?: number })
    .current_period_end;
  const epoch = fromItem ?? fromSub;
  if (typeof epoch !== "number") return null;
  return new Date(epoch * 1000).toISOString();
}

async function profileIdForCustomer(
  customerId: string,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: byId } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();
  if (byId?.id) return byId.id;

  // Fallback: fetch the Stripe customer's email and match it to an
  // auth user. Useful for the first webhook event after a future
  // checkout flow, before profiles.stripe_customer_id is populated.
  try {
    const stripe = getStripe();
    const cust = await stripe.customers.retrieve(customerId);
    if (cust.deleted) return null;
    const email = cust.email;
    if (!email) return null;

    const { data: list, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) {
      console.error("stripe webhook: auth.admin.listUsers failed:", error);
      return null;
    }
    const match = list.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    return match?.id ?? null;
  } catch (err) {
    console.error("stripe webhook: customer/email fallback failed:", err);
    return null;
  }
}

async function customerEmail(customerId: string): Promise<string | null> {
  try {
    const stripe = getStripe();
    const cust = await stripe.customers.retrieve(customerId);
    if (cust.deleted) return null;
    return cust.email ?? null;
  } catch (err) {
    console.error("stripe webhook: customers.retrieve failed:", err);
    return null;
  }
}

async function applySubscription(
  sub: Stripe.Subscription,
  isCreated: boolean,
): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const profileId = await profileIdForCustomer(customerId);
  if (!profileId) {
    console.warn(
      `stripe webhook: no profile for customer ${customerId} (sub ${sub.id})`,
    );
    return;
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      stripe_subscription_status: coerceStatus(sub.status),
      current_period_end: periodEndIso(sub),
    })
    .eq("id", profileId);

  if (error) {
    throw new Error(`profiles update failed: ${error.message}`);
  }

  if (!isCreated) return;

  // First paid event for this subscription. Stamp the application row
  // (matched by customer email) and, if this is the founding-crew price,
  // mark the profile.
  const email = await customerEmail(customerId);
  if (email) {
    const { error: stampErr } = await supabase
      .from("applications")
      .update({ first_paid_at: new Date().toISOString() })
      .eq("email", email.toLowerCase())
      .is("first_paid_at", null);
    if (stampErr) {
      console.error(
        "stripe webhook: applications.first_paid_at update failed:",
        stampErr,
      );
    }
  }

  const foundingPriceId = process.env.STRIPE_FOUNDING_PRICE_ID;
  if (foundingPriceId) {
    const priceId = sub.items.data[0]?.price?.id;
    if (priceId === foundingPriceId) {
      const { error: foundingErr } = await supabase
        .from("profiles")
        .update({ founding_crew_at: new Date().toISOString() })
        .eq("id", profileId)
        .is("founding_crew_at", null);
      if (foundingErr) {
        console.error(
          "stripe webhook: founding_crew_at update failed:",
          foundingErr,
        );
      }
    }
  }
}

async function handleCrewPlusCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const applicationId = session.metadata?.application_id;
  // draft_lead_id is intentionally optional — applications submitted via
  // the cold /apply form (no draft) still flow through Crew Plus checkout.
  const draftLeadIdRaw = session.metadata?.draft_lead_id;
  const draftLeadId =
    typeof draftLeadIdRaw === "string" && draftLeadIdRaw.length > 0
      ? draftLeadIdRaw
      : null;

  if (!applicationId) {
    console.error(
      "crew-plus webhook: session missing application_id metadata",
      session.id,
    );
    return;
  }

  const supabase = createServiceClient();

  const { data: application, error: appErr } = await supabase
    .from("applications")
    .select("id, email")
    .eq("id", applicationId)
    .maybeSingle<{ id: string; email: string }>();
  if (appErr || !application) {
    console.error(
      "crew-plus webhook: application lookup failed",
      applicationId,
      appErr,
    );
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) {
    console.error("crew-plus webhook: session missing customer id", session.id);
    return;
  }

  const email = session.customer_email ?? application.email;

  // Provision the auth user + profile. NOT a founding member — Crew Plus
  // is the standard tier; founding_crew_at stays null. Membership is
  // identified by paid stripe_subscription_status values plus a non-null
  // applications.first_paid_at.
  let profile: { id: string; isNew: boolean };
  try {
    profile = await provisionProfileForCheckout({
      email,
      customerId,
      isFoundingMember: false,
    });
  } catch (err) {
    console.error("crew-plus webhook: provisionProfileForCheckout failed", err);
    return;
  }

  // Pre-seed the first trip from the draft when one is linked.
  if (draftLeadId) {
    const { data: draft, error: draftErr } = await supabase
      .from("draft_leads")
      .select("*")
      .eq("id", draftLeadId)
      .maybeSingle<DraftLead>();
    if (draftErr || !draft) {
      console.error(
        "crew-plus webhook: draft lookup failed",
        draftLeadId,
        draftErr,
      );
    } else {
      try {
        await createFirstTripFromDraft(profile.id, draft);
      } catch (err) {
        console.error(
          "crew-plus webhook: createFirstTripFromDraft failed",
          err,
        );
        // Non-fatal — the user can still create a trip manually.
      }
    }
  }

  // Stamp first_paid_at + the user_id link so the application row tracks
  // the lifecycle. Bypasses the email-matched stamp in applySubscription
  // by going through the application id directly.
  const { error: stampErr } = await supabase
    .from("applications")
    .update({
      first_paid_at: new Date().toISOString(),
      user_id: profile.id,
    })
    .eq("id", applicationId);
  if (stampErr) {
    console.error(
      "crew-plus webhook: applications stamp update failed",
      stampErr,
    );
  }

  // Fire the magic link last. Don't await — the customer is already on
  // the Stripe success page; sendMagicLink swallows its own errors.
  void sendMagicLink(email);
}

async function handleFoundingCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const reservationId = session.metadata?.reservation_id;
  const draftLeadId = session.metadata?.draft_lead_id;

  if (!reservationId || !draftLeadId) {
    console.error(
      "founding checkout session missing metadata",
      session.id,
      session.metadata,
    );
    return;
  }

  const supabase = createServiceClient();

  // 1. Consume the reservation. This is the source of truth that the
  // seat is taken — even if downstream provisioning fails, the seat
  // stays consumed (the human can be unblocked manually) rather than
  // leaving the seat available for another claimant after we've already
  // taken their money.
  const { error: consumeErr } = await supabase
    .from("founding_reservations")
    .update({ consumed: true })
    .eq("id", reservationId);
  if (consumeErr) {
    console.error("founding webhook: reservation consume failed", consumeErr);
    // Continue anyway — the customer paid, we still need to provision.
  }

  // 2. Read the draft so we can seed the user's first trip.
  const { data: draft, error: draftErr } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", draftLeadId)
    .maybeSingle<DraftLead>();
  if (draftErr || !draft) {
    console.error(
      "founding webhook: draft lookup failed",
      draftLeadId,
      draftErr,
    );
    return;
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const email = session.customer_email ?? draft.email;
  if (!customerId) {
    console.error(
      "founding webhook: session missing customer id",
      session.id,
    );
    return;
  }

  // 3. Provision the auth user + profile.
  let profile: { id: string; isNew: boolean };
  try {
    profile = await provisionProfileForCheckout({
      email,
      customerId,
      isFoundingMember: true,
    });
  } catch (err) {
    console.error("founding webhook: provisionProfileForCheckout failed", err);
    return;
  }

  // 4. Create their first trip pre-seeded with the draft's inputs.
  try {
    await createFirstTripFromDraft(profile.id, draft);
  } catch (err) {
    console.error("founding webhook: createFirstTripFromDraft failed", err);
    // Non-fatal: the profile is provisioned, the user can still create
    // a trip manually. Surface for ops review.
  }

  // 5. Fire the magic link. Don't await — the user gets the Stripe
  // success page redirect immediately and the email follows. Failures
  // are logged inside sendMagicLink itself.
  void sendMagicLink(email);
}

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      getWebhookSecret(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe webhook: signature verification failed:", message);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
        await applySubscription(event.data.object as Stripe.Subscription, true);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object as Stripe.Subscription, false);
        break;
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const kind = session.metadata?.kind;
        if (kind === "founding") {
          await handleFoundingCheckoutCompleted(session);
        } else if (kind === "crew_plus") {
          await handleCrewPlusCheckoutCompleted(session);
        }
        break;
      }
      default:
        // Acknowledge unhandled events so Stripe doesn't retry. We
        // narrow the surface deliberately — this handler only owns
        // subscription state on profiles + the Founding fast lane.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`stripe webhook: ${event.type} (${event.id}) failed:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
