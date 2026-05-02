import Anthropic from "@anthropic-ai/sdk";

import type { CoachStats } from "@/lib/sheets";

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new Anthropic({ apiKey });
}

export async function generateCoachMessage(stats: CoachStats): Promise<string> {
  const client = getAnthropicClient();

  if (!client) {
    return "Task updated successfully. Add `ANTHROPIC_API_KEY` to enable Claude coaching messages.";
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20250514";
  const prompt = [
    `Team member: ${stats.member}`,
    `Week: ${stats.weekStart} to ${stats.weekEnd}`,
    `Completed tasks: ${stats.completedTasks}/${stats.totalTasks}`,
    `Late tasks: ${stats.lateTasks}`,
    `Missed tasks: ${stats.missedTasks}`,
    `Weekly score: ${stats.score}`,
    "Write a supportive coaching message in 2 short sentences.",
    "Keep it direct, mobile-friendly, and practical."
  ].join("\n");

  const response = await client.messages.create({
    model,
    max_tokens: 120,
    system:
      "You are a concise productivity coach for a small task management app. Keep responses positive and actionable.",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text.trim() : "Nice work. Keep the momentum going.";
}
