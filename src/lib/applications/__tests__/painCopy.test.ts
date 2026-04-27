import assert from "node:assert/strict";
import test from "node:test";
import { painMirror, painEmailOpener } from "@/lib/applications/painCopy";

test("painMirror returns the confirmation-page mirror line for each pain value", () => {
  assert.equal(painMirror("dates"), "You said dates never align.");
  assert.equal(painMirror("booking"), "You said nobody books anything.");
  assert.equal(painMirror("money"), "You said money gets weird.");
  assert.equal(painMirror("plan"), "You said the plan never gets made.");
  assert.equal(painMirror("chaos"), "You said your trips happen but feel chaotic.");
});

test("painEmailOpener returns the welcome-email opener for each pain value", () => {
  assert.match(painEmailOpener("dates"), /dates/);
  assert.match(painEmailOpener("booking"), /book/);
  assert.match(painEmailOpener("money"), /money/);
  assert.match(painEmailOpener("plan"), /plan/);
  assert.match(painEmailOpener("chaos"), /chaotic/);
});
