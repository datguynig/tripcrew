import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getWebhookSecret } from "@/lib/stripe/server";
import {
  handleCrewPlusCheckoutCompleted,
  handleFoundingCheckoutCompleted,
} from "@/lib/stripe/webhookCheckout";

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

function webhookFatal(message: string, context?: unknown): never {
  if (context !== undefined) {
    console.error(message, context);
  } else {
    console.error(message);
  }
  throw new Error(message);
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
    const message = `stripe webhook: no profile for customer ${customerId} (sub ${sub.id})`;
    if (isCreated) {
      webhookFatal(message);
    }
    console.warn(message);
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
      const { applyFoundingStamps } = await import(
        "@/lib/stripe/foundingStamps"
      );
      await applyFoundingStamps(supabase, profileId);
    }
  }
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
