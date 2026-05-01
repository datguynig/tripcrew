import assert from "node:assert/strict";
import test from "node:test";
import { buildWelcomeEmail } from "@/lib/email/welcomeEmail";

test("buildWelcomeEmail mirrors the pain in the opening line", () => {
  const email = buildWelcomeEmail({
    to: "sarah@example.com",
    magicLinkUrl: "https://yenkoh.com/auth/magic?token=x",
    pain: "dates",
  });
  assert.match(email.subject, /in/i);
  assert.match(email.text, /dates never align/);
  assert.match(email.text, /https:\/\/yenkoh\.com\/auth\/magic\?token=x/);
});

test("buildWelcomeEmail derives a first name from the email local part", () => {
  const email = buildWelcomeEmail({
    to: "marcus.smith@startup.io",
    magicLinkUrl: "x",
    pain: "money",
  });
  assert.match(email.subject, /Marcus/);
});

test("buildWelcomeEmail uses 'there' when the local part is empty", () => {
  const email = buildWelcomeEmail({
    to: "@example.com",
    magicLinkUrl: "x",
    pain: "plan",
  });
  assert.match(email.subject, /there/);
});
