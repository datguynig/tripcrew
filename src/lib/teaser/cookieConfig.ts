export const DRAFT_COOKIE_NAME = "tc_draft_id";
export const DRAFT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

export function draftCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: DRAFT_COOKIE_MAX_AGE,
    path: "/",
  };
}
