"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { useSessionWithTimeout } from "@/hooks/useSessionWithTimeout";

export function Nav() {
  const { data: session, status } = useSessionWithTimeout();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "loading") {
    return (
      <header className="border-b border-rh-border bg-rh-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-rh-muted text-sm">Loading…</span>
        </div>
      </header>
    );
  }

  if (!session) {
    return (
      <header className="border-b border-rh-border bg-rh-black/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
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
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-rh-white">
          sRobinhood
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-rh-muted text-sm truncate max-w-[180px]">
            {session.user?.name ?? session.user?.email}
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
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-rh-muted hover:text-rh-white hover:bg-rh-border transition-colors"
              aria-expanded={menuOpen}
              aria-haspopup="true"
              aria-label="Account menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 min-w-[140px] rounded-lg bg-rh-card border border-rh-border shadow-lg z-20">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-rh-muted hover:text-rh-white hover:bg-rh-border transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
