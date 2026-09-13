import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth/config";

// Edge-safe instance: reads and verifies the session cookie only. Role checks
// happen server-side per request in `lib/auth/session.ts`, because a role is
// per-store and must not be cached in the token.
const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/admin", "/agency", "/platform"];

export default auth((request) => {
  const { pathname, search } = request.nextUrl;

  const needsSession = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (needsSession && !request.auth) {
    const signIn = new URL("/login", request.nextUrl.origin);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  // Sending a signed-in visitor away from /login is deliberately NOT done
  // here. Middleware runs on the edge with no database, so all it can see is
  // that the cookie's signature checks out — not whether the account still
  // exists. When it does not (a deleted user, a restored database), the page
  // guard bounces to /login and a rule here would bounce straight back:
  // /admin → /login → /admin, and the visitor cannot even reach the form to
  // sign in again. `app/login/page.tsx` makes that call instead, where it can
  // actually look the user up.

  return NextResponse.next();
});

export const config = {
  // Only the three areas that actually need a session.
  //
  // This used to match everything bar a list of exclusions, which meant every
  // new public route had to be remembered and added to that list — the
  // marketing pages were silently decoding a session cookie for no reason.
  // Naming the protected prefixes instead makes the default safe: anything
  // public simply never reaches this file. `:path*` matches the prefix itself
  // as well as everything beneath it.
  matcher: ["/admin/:path*", "/agency/:path*", "/platform/:path*"],
};
