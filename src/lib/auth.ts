import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";

if (!clientId) {
  throw new Error(
    "GOOGLE_CLIENT_ID is required. Add it to .env.local and restart the dev server. Get it from Google Cloud Console → APIs & Services → Credentials → create OAuth 2.0 Client ID."
  );
}
if (!clientSecret) {
  throw new Error(
    "GOOGLE_CLIENT_SECRET is required. Add it to .env.local and restart the dev server. Get it from the same OAuth 2.0 Client in Google Cloud Console."
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId,
      clientSecret,
    }),
  ],
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
