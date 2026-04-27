import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Exclude /api/* from auth-gating: external callers (e.g. the Stripe
    // webhook at /api/stripe/webhook) won't carry a Supabase session cookie
    // and would otherwise be 307-redirected to /sign-in. Each /api/ route
    // is responsible for its own auth (signature verification, JWT, etc.).
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
