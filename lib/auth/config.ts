import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe slice of the Auth.js configuration.
 *
 * It deliberately contains no providers and touches no database, so it can be
 * imported by `proxy.ts` (which runs on the edge runtime) to read the session
 * cookie. The full configuration, including the credentials provider and the
 * password check, lives in `auth.ts` and runs on the node runtime.
 *
 * Note what is NOT in the session: a role. Roles are per-store
 * (`store_memberships`), so they are resolved from the database on every
 * request by `lib/auth/session.ts` instead of being cached in a JWT where a
 * revoked membership would keep working until the token expired.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login", error: "/login" },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
