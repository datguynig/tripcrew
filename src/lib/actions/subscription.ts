"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export type CheckoutResult =
  | { success: true; url: string }
  | { success: false; error: string };

const DEFAULT_PRICE_ID = "price_1TQXvUFBs06X81bmpNNuXssa"; // live Crew Plus £4.99/mo
const TRIAL_DAYS = 7;

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function createCheckoutSession(): Promise<CheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  const priceId = process.env.STRIPE_PRICE_ID ?? DEFAULT_PRICE_ID;
  const origin = await siteOrigin();

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: TRIAL_DAYS },
      allow_promotion_codes: true,
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      success_url: `${origin}/account/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/account?checkout=canceled`,
      metadata: { user_id: user.id },
    });

    if (!session.url) {
      return { success: false, error: "Stripe didn't return a checkout URL." };
    }
    return { success: true, url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("createCheckoutSession failed:", err);
    return { success: false, error: message };
  }
}

export async function createBillingPortalSession(): Promise<CheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle<{ stripe_customer_id: string | null }>();

  if (!profile?.stripe_customer_id) {
    return { success: false, error: "No Stripe customer on file." };
  }

  const origin = await siteOrigin();

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return { success: true, url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("createBillingPortalSession failed:", err);
    return { success: false, error: message };
  }
}
