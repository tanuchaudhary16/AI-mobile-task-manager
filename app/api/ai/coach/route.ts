import { NextRequest, NextResponse } from "next/server";

import { generateCoachMessage } from "@/lib/claude";
import type { CoachStats } from "@/lib/sheets";

export async function POST(request: NextRequest) {
  try {
    const stats = (await request.json()) as CoachStats;
    const message = await generateCoachMessage(stats);

    return NextResponse.json({ message });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate coach message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
