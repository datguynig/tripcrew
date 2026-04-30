import assert from "node:assert/strict";
import test from "node:test";

// This test asserts behaviour that lives in route.ts. We extract the
// founding-stamp branch into a helper to make it testable.
import { applyFoundingStamps } from "@/lib/stripe/foundingStamps";

test("applyFoundingStamps stamps both founding_crew_at and pricing_grandfathered_at when null", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const supabase = {
    from() {
      return {
        update(payload: Record<string, unknown>) {
          updates.push(payload);
          return {
            eq() {
              return {
                is() {
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  await applyFoundingStamps(supabase as never, "profile-1");

  assert.equal(updates.length, 1);
  assert.ok(updates[0].founding_crew_at);
  assert.ok(updates[0].pricing_grandfathered_at);
  assert.equal(
    typeof updates[0].founding_crew_at,
    typeof updates[0].pricing_grandfathered_at,
  );
});
