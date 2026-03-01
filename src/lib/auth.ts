import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

const allowDevLogin = process.env.ALLOW_DEV_LOGIN === "true";
const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";

if (!allowDevLogin) {
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
}

const providers: NextAuthOptions["providers"] = [];
if (clientId && clientSecret) {
  providers.push(
    GoogleProvider({
      clientId,
      clientSecret,
    })
  );
}
if (allowDevLogin) {
  providers.push(
    CredentialsProvider({
      name: "Dev login",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials?.email === "dev@local" &&
          credentials?.password === "dev"
        ) {
          return { id: "dev-1", email: "dev@local", name: "Dev User" };
        }
        return null;
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.sub ?? "";
      }
      return session;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
