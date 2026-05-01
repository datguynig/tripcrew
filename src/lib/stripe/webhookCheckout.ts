import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createFirstTripFromDraft,
  provisionProfileForCheckout,
  sendMagicLink,
} from "@/lib/auth/checkoutProvisioning";
import type { DraftLead } from "@/lib/types";

export type CheckoutWebhookDeps = {
  createServiceClient: typeof createServiceClient;
  provisionProfileForCheckout: typeof provisionProfileForCheckout;
  createFirstTripFromDraft: typeof createFirstTripFromDraft;
  sendMagicLink: typeof sendMagicLink;
};

const defaultDeps: CheckoutWebhookDeps = {
  createServiceClient,
  provisionProfileForCheckout,
  createFirstTripFromDraft,
  sendMagicLink,
};

function webhookFatal(message: string, context?: unknown): never {
  if (context !== undefined) {
    console.error(message, context);
  } else {
    console.error(message);
  }
  throw new Error(message);
}

export async function handleCrewPlusCheckoutCompleted(
  session: Stripe.Checkout.Session,
  deps: CheckoutWebhookDeps = defaultDeps,
): Promise<void> {
  const applicationId = session.metadata?.application_id;
  // draft_lead_id is intentionally optional - applications submitted via
  // the cold /apply form (no draft) still flow through Crew Plus checkout.
  const draftLeadIdRaw = session.metadata?.draft_lead_id;
  const draftLeadId =
    typeof draftLeadIdRaw === "string" && draftLeadIdRaw.length > 0
      ? draftLeadIdRaw
      : null;

  if (!applicationId) {
    webhookFatal(
      "crew-plus webhook: session missing application_id metadata",
      { sessionId: session.id },
    );
  }

  const supabase = deps.createServiceClient();

  const { data: application, error: appErr } = await supabase
    .from("applications")
    .select("id, email")
    .eq("id", applicationId)
    .maybeSingle<{ id: string; email: string }>();
  if (appErr || !application) {
    webhookFatal(
      "crew-plus webhook: application lookup failed",
      { applicationId, error: appErr },
    );
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  if (!customerId) {
    webhookFatal("crew-plus webhook: session missing customer id", {
      sessionId: session.id,
    });
  }

  const email = session.customer_email ?? application.email;

  // Provision the auth user + profile. NOT a founding member - Crew Plus
  // is the standard tier; founding_crew_at stays null. Membership is
  // identified by paid stripe_subscription_status values plus a non-null
  // applications.first_paid_at.
  let profile: { id: string; isNew: boolean };
  try {
    profile = await deps.provisionProfileForCheckout({
      email,
      customerId,
      isFoundingMember: false,
    });
  } catch (err) {
    webhookFatal("crew-plus webhook: provisionProfileForCheckout failed", err);
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
        await deps.createFirstTripFromDraft(profile.id, draft);
      } catch (err) {
        console.error(
          "crew-plus webhook: createFirstTripFromDraft failed",
          err,
        );
        // Non-fatal - the user can still create a trip manually.
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
    webhookFatal(
      "crew-plus webhook: applications stamp update failed",
      stampErr,
    );
  }

  // Fire the magic link last. Don't await - the customer is already on
  // the Stripe success page; sendMagicLink swallows its own errors.
  void deps.sendMagicLink(email);
}

export async function handleFoundingCheckoutCompleted(
  session: Stripe.Checkout.Session,
  deps: CheckoutWebhookDeps = defaultDeps,
): Promise<void> {
  const reservationId = session.metadata?.reservation_id;
  const draftLeadId = session.metadata?.draft_lead_id;

  if (!reservationId || !draftLeadId) {
    webhookFatal(
      "founding checkout session missing metadata",
      { sessionId: session.id, metadata: session.metadata },
    );
  }

  const supabase = deps.createServiceClient();

  // 1. Consume the reservation. This is the source of truth that the
  // seat is taken - even if downstream provisioning fails, the seat
  // stays consumed (the human can be unblocked manually) rather than
  // leaving the seat available for another claimant after we've already
  // taken their money.
  const { error: consumeErr } = await supabase
    .from("founding_reservations")
    .update({ consumed: true })
    .eq("id", reservationId);
  if (consumeErr) {
    webhookFatal("founding webhook: reservation consume failed", consumeErr);
  }

  // 2. Read the draft so we can seed the user's first trip.
  const { data: draft, error: draftErr } = await supabase
    .from("draft_leads")
    .select("*")
    .eq("id", draftLeadId)
    .maybeSingle<DraftLead>();
  if (draftErr || !draft) {
    webhookFatal(
      "founding webhook: draft lookup failed",
      { draftLeadId, error: draftErr },
    );
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
  const email = session.customer_email ?? draft.email;
  if (!customerId) {
    webhookFatal(
      "founding webhook: session missing customer id",
      { sessionId: session.id },
    );
  }

  // 3. Provision the auth user + profile.
  let profile: { id: string; isNew: boolean };
  try {
    profile = await deps.provisionProfileForCheckout({
      email,
      customerId,
      isFoundingMember: true,
    });
  } catch (err) {
    webhookFatal("founding webhook: provisionProfileForCheckout failed", err);
  }

  // 4. Create their first trip pre-seeded with the draft's inputs.
  try {
    await deps.createFirstTripFromDraft(profile.id, draft);
  } catch (err) {
    console.error("founding webhook: createFirstTripFromDraft failed", err);
    // Non-fatal: the profile is provisioned, the user can still create
    // a trip manually. Surface for ops review.
  }

  // 5. Fire the magic link. Don't await - the user gets the Stripe
  // success page redirect immediately and the email follows. Failures
  // are logged inside sendMagicLink itself.
  void deps.sendMagicLink(email);
}
