import assert from "node:assert/strict";
import test from "node:test";
import {
  applicationEmailSchema,
  applicationAnswersSchema,
  fullApplicationSchema,
} from "@/lib/validators/application";

test("applicationEmailSchema accepts a normal email", () => {
  assert.equal(applicationEmailSchema.safeParse("a@b.co").success, true);
});

test("applicationEmailSchema rejects empty input", () => {
  assert.equal(applicationEmailSchema.safeParse("").success, false);
});

test("applicationEmailSchema rejects non-email strings", () => {
  assert.equal(applicationEmailSchema.safeParse("not an email").success, false);
});

test("applicationAnswersSchema accepts the four enumerated answers", () => {
  const result = applicationAnswersSchema.safeParse({
    trips_per_year: "2-3",
    role: "organiser",
    pain: "dates",
    budget_attitude: "monopoly",
  });
  assert.equal(result.success, true);
});

test("applicationAnswersSchema rejects an unexpected pain value", () => {
  const result = applicationAnswersSchema.safeParse({
    trips_per_year: "2-3",
    role: "organiser",
    pain: "everything",
    budget_attitude: "monopoly",
  });
  assert.equal(result.success, false);
});

test("fullApplicationSchema requires email and four answers, accepts optional UTM", () => {
  const result = fullApplicationSchema.safeParse({
    email: "a@b.co",
    trips_per_year: "1",
    role: "depends",
    pain: "booking",
    budget_attitude: "count",
    utm_source: "twitter",
  });
  assert.equal(result.success, true);
});
