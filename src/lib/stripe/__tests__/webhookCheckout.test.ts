import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
  handleCrewPlusCheckoutCompleted,
  handleFoundingCheckoutCompleted,
  type CheckoutWebhookDeps,
} from "@/lib/stripe/webhookCheckout";
import { createServiceClient } from "@/lib/supabase/server";
import type { DraftLead } from "@/lib/types";

type DbResult<T = unknown> = { data?: T | null; error?: unknown };

function makeSupabase(config: {
  select?: Record<string, DbResult>;
  update?: Record<string, DbResult>;
}) {
  return {
    from(table: string) {
      let operation: "select" | "update" | null = null;
      const builder = {
        select() {
          operation = "select";
          return builder;
        },
        update() {
          operation = "update";
          return builder;
        },
        eq() {
          if (operation === "update") {
            return Promise.resolve(config.update?.[table] ?? { error: null });
          }
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(
            config.select?.[table] ?? { data: null, error: null },
          );
        },
      };
      return builder;
    },
  };
}

function makeDeps(config: {
  supabase: ReturnType<typeof makeSupabase>;
  provision?: CheckoutWebhookDeps["provisionProfileForCheckout"];
  createTrip?: CheckoutWebhookDeps["createFirstTripFromDraft"];
  sendMagicLink?: CheckoutWebhookDeps["sendMagicLink"];
}): CheckoutWebhookDeps {
  return {
    createServiceClient: (() =>
      config.supabase as unknown as ReturnType<
        typeof createServiceClient
      >) as typeof createServiceClient,
    provisionProfileForCheckout:
      config.provision ??
      (async () => ({ id: "profile-123", isNew: false })),
    createFirstTripFromDraft:
      config.createTrip ?? (async () => ({ id: "trip-123" })),
    sendMagicLink: config.sendMagicLink ?? (async () => {}),
  };
}

function crewPlusSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_crew",
    customer: "cus_123",
    customer_email: "alex@example.com",
    metadata: {
      kind: "crew_plus",
      application_id: "app-123",
      draft_lead_id: "",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

function foundingSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_founder",
    customer: "cus_123",
    customer_email: "alex@example.com",
    metadata: {
      kind: "founding",
      reservation_id: "reservation-123",
      draft_lead_id: "draft-123",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

const draft = {
  id: "draft-123",
  email: "alex@example.com",
  slug: "bali",
  inputs: {
    origin: "MAN",
    crew: "5-6",
    when: "week",
    budget: "1500",
  },
} as unknown as DraftLead;

async function withSilencedWebhookErrors(action: () => Promise<void>) {
  const originalError = console.error;
  console.error = () => {};
  try {
    await action();
  } finally {
    console.error = originalError;
  }
}

test("Crew Plus checkout throws when provisioning fails so Stripe retries", async () => {
  const deps = makeDeps({
    supabase: makeSupabase({
      select: {
        applications: { data: { id: "app-123", email: "alex@example.com" } },
      },
    }),
    provision: async () => {
      throw new Error("profile write failed");
    },
  });

  await withSilencedWebhookErrors(async () => {
    await assert.rejects(
      () => handleCrewPlusCheckoutCompleted(crewPlusSession(), deps),
      /provisionProfileForCheckout failed/,
    );
  });
});

test("Crew Plus checkout throws when application lifecycle stamp fails", async () => {
  const deps = makeDeps({
    supabase: makeSupabase({
      select: {
        applications: { data: { id: "app-123", email: "alex@example.com" } },
      },
      update: {
        applications: { error: new Error("update failed") },
      },
    }),
  });

  await withSilencedWebhookErrors(async () => {
    await assert.rejects(
      () => handleCrewPlusCheckoutCompleted(crewPlusSession(), deps),
      /applications stamp update failed/,
    );
  });
});

test("Founding checkout throws when reservation consume fails", async () => {
  const deps = makeDeps({
    supabase: makeSupabase({
      update: {
        founding_reservations: { error: new Error("reservation update failed") },
      },
    }),
  });

  await withSilencedWebhookErrors(async () => {
    await assert.rejects(
      () => handleFoundingCheckoutCompleted(foundingSession(), deps),
      /reservation consume failed/,
    );
  });
});

test("Founding checkout throws when provisioning fails so Stripe retries", async () => {
  const deps = makeDeps({
    supabase: makeSupabase({
      select: {
        draft_leads: { data: draft },
      },
      update: {
        founding_reservations: { error: null },
      },
    }),
    provision: async () => {
      throw new Error("profile write failed");
    },
  });

  await withSilencedWebhookErrors(async () => {
    await assert.rejects(
      () => handleFoundingCheckoutCompleted(foundingSession(), deps),
      /provisionProfileForCheckout failed/,
    );
  });
});

test("Founding checkout treats first-trip creation failure as non-fatal", async () => {
  let magicLinkSent = false;
  const deps = makeDeps({
    supabase: makeSupabase({
      select: {
        draft_leads: { data: draft },
      },
      update: {
        founding_reservations: { error: null },
      },
    }),
    createTrip: async () => {
      throw new Error("trip seed failed");
    },
    sendMagicLink: async () => {
      magicLinkSent = true;
    },
  });

  await withSilencedWebhookErrors(async () => {
    await handleFoundingCheckoutCompleted(foundingSession(), deps);
  });
  assert.equal(magicLinkSent, true);
});
