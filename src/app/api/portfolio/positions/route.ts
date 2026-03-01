/**
 * User positions. Requires auth; in production, resolve user from session and read from your DB.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Position } from "@/types";

// Placeholder: no session adapter in this example, so return empty or mock.
// Your pipeline/DB would key positions by user id from getServerSession().
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json([]);
  }
  // TODO: fetch from DB/API by session.user.id
  const positions: Position[] = [];
  return NextResponse.json(positions);
}
