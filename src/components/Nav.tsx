"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useSessionWithTimeout } from "@/hooks/useSessionWithTimeout";

export function Nav() {
  const { data: session, status } = useSessionWithTimeout();

  if (status === "loading") {
    return (
      <header className="border-b border-rh-border bg-rh-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-rh-muted text-sm">Loading…</span>
        </div>
      </header>
    );
  }

  if (!session) {
    return (
      <header className="border-b border-rh-border bg-rh-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-rh-white">
            sRobinhood
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-rh-green hover:underline"
          >
            Log in
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-rh-border bg-rh-black/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-rh-white">
          sRobinhood
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-rh-muted text-sm truncate max-w-[180px]">
            {session.user?.email}
          </span>
          {session.user?.image && (
            <Image
              src={session.user.image}
              alt=""
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-rh-muted hover:text-rh-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
