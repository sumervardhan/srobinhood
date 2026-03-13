import { NextResponse } from "next/server";

/**
 * Only used by the login page to show the "Dev login" option when
 * ALLOW_DEV_LOGIN=true (e.g. for Cursor's built-in browser).
 */
export async function GET() {
  return NextResponse.json({
    enabled: process.env.ALLOW_DEV_LOGIN === "true",
  });
}
