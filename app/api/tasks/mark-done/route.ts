import { NextRequest, NextResponse } from "next/server";

import { generateCoachMessage } from "@/lib/claude";
import { markTaskDone } from "@/lib/sheets";

type MarkDoneBody = {
  rowNumber?: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MarkDoneBody;

    if (!body.rowNumber) {
      return NextResponse.json({ error: "Missing rowNumber." }, { status: 400 });
    }

    const { updatedTask, stats } = await markTaskDone(body.rowNumber);
    const coachMessage = await generateCoachMessage(stats);

    return NextResponse.json({
      task: updatedTask,
      stats,
      coachMessage
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update task.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
