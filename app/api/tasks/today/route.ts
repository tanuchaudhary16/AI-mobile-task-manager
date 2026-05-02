import { NextRequest, NextResponse } from "next/server";

import { getTasksForToday, getTodayDate, recomputeWeeklyScoresForMember } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  const memberName = request.nextUrl.searchParams.get("name")?.trim();

  if (!memberName) {
    return NextResponse.json({ error: "Missing query parameter: name" }, { status: 400 });
  }

  try {
    const [tasks, stats] = await Promise.all([
      getTasksForToday(memberName),
      recomputeWeeklyScoresForMember(memberName, new Date().toISOString().slice(0, 10))
    ]);

    return NextResponse.json({
      memberName,
      tasks,
      stats
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tasks.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
