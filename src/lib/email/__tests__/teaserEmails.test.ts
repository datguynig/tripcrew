import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDay7NudgeEmail,
  buildTeaserConfirmationEmail,
} from "@/lib/email/teaserEmails";
import type { TeaserInputs, TeaserOutput } from "@/lib/types";

const FIXTURE_INPUTS: TeaserInputs = {
  origin: "MAN",
  crew: "5-6",
  when: "week",
  budget: "1500",
};

const FIXTURE_TEASER: TeaserOutput = {
  spec: {
    perHead: "£1.5k",
    crew: "Five or six",
    origin: "MAN",
    vibes: "Beach + temples",
  },
  hero_paragraph:
    "Bali in week-long form, anchored around Ubud's terraces and Canggu's surf — your crew of five splits stays under £1.5k a head.",
  days: [
    { day: "Day 1", place: "Canggu", note: "Land + dinner at Old Man's." },
    { day: "Day 2", place: "Ubud", note: "Tegallalang at sunrise." },
  ],
  stay: { neighbourhood: "Canggu", priceBand: "£90/night" },
  flights: { priceBand: "£600 return from MAN" },
  bookings_count: 4,
  weather: "Dry season, low humidity, evenings around 24 C.",
};

test("buildTeaserConfirmationEmail includes the teaser hero paragraph verbatim", () => {
  const email = buildTeaserConfirmationEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "bali",
    inputs: FIXTURE_INPUTS,
    teaser: FIXTURE_TEASER,
  });
  assert.ok(
    email.text.includes(FIXTURE_TEASER.hero_paragraph),
    "hero paragraph must be embedded verbatim",
  );
});

test("buildTeaserConfirmationEmail includes resume link with correct query params", () => {
  const email = buildTeaserConfirmationEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "bali",
    inputs: FIXTURE_INPUTS,
    teaser: FIXTURE_TEASER,
  });
  assert.match(
    email.text,
    /\/api\/teaser\/resume\?id=draft-123&token=tok-abc&slug=bali/,
  );
});

test("buildTeaserConfirmationEmail includes unsubscribe link", () => {
  const email = buildTeaserConfirmationEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "bali",
    inputs: FIXTURE_INPUTS,
    teaser: FIXTURE_TEASER,
  });
  assert.match(
    email.text,
    /\/api\/teaser\/unsubscribe\?id=draft-123&token=tok-abc/,
  );
});

test("buildTeaserConfirmationEmail echoes the visitor's inputs in the body", () => {
  const email = buildTeaserConfirmationEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "bali",
    inputs: FIXTURE_INPUTS,
    teaser: FIXTURE_TEASER,
  });
  assert.match(email.text, /Five or six/);
  assert.match(email.text, /MAN/);
  assert.match(email.text, /a week/);
  assert.match(email.text, /£1,500pp/);
});

test("buildTeaserConfirmationEmail subject is title-cased city", () => {
  const email = buildTeaserConfirmationEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "bali",
    inputs: FIXTURE_INPUTS,
    teaser: FIXTURE_TEASER,
  });
  assert.equal(email.subject, "Your Bali draft is saved.");
});

test("buildDay7NudgeEmail includes the founding remaining count", () => {
  const email = buildDay7NudgeEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "bali",
    foundingRemaining: 312,
  });
  assert.match(email.text, /312 of 500 founding spots/);
});

test("buildDay7NudgeEmail subject starts with the title-cased city", () => {
  const email = buildDay7NudgeEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "tulum",
    foundingRemaining: 100,
  });
  assert.match(email.subject, /^Your Tulum draft/);
});

test("buildDay7NudgeEmail includes resume + unsubscribe links", () => {
  const email = buildDay7NudgeEmail({
    email: "alex@example.com",
    draftId: "draft-123",
    resumeToken: "tok-abc",
    slug: "bali",
    foundingRemaining: 100,
  });
  assert.match(
    email.text,
    /\/api\/teaser\/resume\?id=draft-123&token=tok-abc&slug=bali/,
  );
  assert.match(
    email.text,
    /\/api\/teaser\/unsubscribe\?id=draft-123&token=tok-abc/,
  );
});

test("buildTeaserConfirmationEmail title-cases multi-word slugs", () => {
  const email = buildTeaserConfirmationEmail({
    email: "a@b.com",
    draftId: "id",
    resumeToken: "tk",
    slug: "costa-rica",
    inputs: FIXTURE_INPUTS,
    teaser: FIXTURE_TEASER,
  });
  assert.equal(email.subject, "Your Costa Rica draft is saved.");
});
