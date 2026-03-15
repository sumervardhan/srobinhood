import { getSimulationState, setSimulationMode } from "@/lib/simulation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json(getSimulationState());
}

export async function POST(req: Request) {
  try {
    const { enabled } = (await req.json()) as { enabled: boolean };
    await setSimulationMode(enabled);
    return Response.json(getSimulationState());
  } catch (e) {
    console.error("[admin/simulate] Error:", e);
    return Response.json({ error: "Failed to toggle simulation mode" }, { status: 500 });
  }
}
