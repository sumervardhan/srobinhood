"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const ERROR_MESSAGES: Record<string, { title: string; fix: string }> = {
  Configuration: {
    title: "Server configuration problem",
    fix: "Set NEXTAUTH_SECRET and NEXTAUTH_URL in .env.local. Restart the dev server after changing env.",
  },
  AccessDenied: {
    title: "Access denied",
    fix: "You don’t have permission to sign in, or the app denied the request.",
  },
  Verification: {
    title: "Verification failed",
    fix: "The sign-in link may have been used already or have expired.",
  },
  OAuthSignin: {
    title: "Google sign-in not configured",
    fix: "The error “client_id is required” means GOOGLE_CLIENT_ID is missing or empty. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local in the project root (from Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID). Then restart the dev server (stop and run npm run dev again).",
  },
  OAuthCallback: {
    title: "Error in OAuth callback",
    fix: "Often caused by redirect URI mismatch. In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client, add Authorized redirect URI: http://localhost:3000/api/auth/callback/google (no trailing slash).",
  },
  OAuthCreateAccount: {
    title: "Could not create account",
    fix: "Something went wrong creating your account with the provider.",
  },
  Callback: {
    title: "Callback error",
    fix: "Ensure NEXTAUTH_SECRET is set and you haven’t changed it since last login. Try signing in again.",
  },
  Default: {
    title: "Sign-in error",
    fix: "Check .env.local: NEXTAUTH_URL=http://localhost:3000, NEXTAUTH_SECRET (random string), GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud Console. Redirect URI in Google must be exactly: http://localhost:3000/api/auth/callback/google",
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error") ?? "Default";
  const { title, fix } = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

  return (
    <div className="min-h-screen bg-rh-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-rh-white tracking-tight">
            {title}
          </h1>
          <p className="text-rh-muted mt-3 text-sm text-left">{fix}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl bg-rh-green text-rh-black font-semibold py-3 px-6 hover:bg-green-400 transition-colors"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="text-sm text-rh-muted hover:text-rh-white transition-colors"
          >
            Back to home
          </Link>
        </div>
        {errorCode !== "Default" && (
          <p className="text-xs text-rh-muted">Error code: {errorCode}</p>
        )}
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-rh-black flex items-center justify-center">
          <span className="text-rh-muted">Loading…</span>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
