import { TypeSafeClient, choice, noul } from "@typesafe-ai/sdk";
import type { RouterDecision, Connector } from "./types.ts";

let _jev: TypeSafeClient | null = null;
function jev(): TypeSafeClient {
  return (_jev ??= new TypeSafeClient({ defaultModel: "jev-latest" }));
}

export const hasJev = () => Boolean(process.env.TYPESAFE_API_KEY);

function heuristicRoute(text: string): RouterDecision {
  const t = text.toLowerCase();
  const picks: [RegExp, Connector][] = [
    [/\b(emails?|inbox|gmail|mails?|unread|replies|reply)\b/, "gmail"],
    [/\b(calendar|meetings?|schedule|book|invite|availability|event)\b/, "calendar"],
    [/\b(notion|notes?|pages?|docs?|wiki)\b/, "notion"],
    [/\b(drive|files?|folders?|spreadsheets?|sheets?)\b/, "drive"],
    [/\b(canva|designs?|posters?|slides?)\b/, "canva"],
    [/\b(image|video|generate|higgsfield|render)\b/, "higgsfield"],
  ];
  const hit = picks.find(([re]) => re.test(t));
  return {
    connector: hit?.[1] ?? "none",
    model: text.length > 240 ? "sonnet" : "haiku",
    missing: 0.1,
    confidence: 0.6,
  };
}

export async function route(userText: string): Promise<RouterDecision> {
  if (!hasJev()) return heuristicRoute(userText);
  const { answers } = await jev().systemOne({
    state: { request: userText },
    questions: {
      connector: choice("Which connector should handle this request?", {
        gmail: "Reading, searching, sending, drafting or replying to email.",
        calendar: "Scheduling, finding or cancelling meetings; checking availability.",
        notion: "Reading, searching, creating or updating pages and databases.",
        drive: "Searching, reading, uploading or sharing files.",
        canva: "Creating, editing or exporting designs.",
        higgsfield: "Generating images, video, voice or any media.",
        none: "Pure conversation, a math question, or anything that needs no outside tool.",
      }),
      model: choice("Which Claude model fits the job?", {
        haiku: "A quick lookup, a short reformat, a single-fact answer.",
        sonnet: "A normal multi-step task: draft an email, summarise messages, plan a short reply.",
        opus: "Deep reasoning, long synthesis across many sources, or something risky where mistakes are expensive.",
      }),
      missing: noul(
        "The user has not supplied enough detail for Ultron to act without guessing (missing recipient, missing time, ambiguous target, etc).",
      ),
    },
  });

  return {
    connector: answers.connector.choice,
    model: answers.model.choice,
    missing: answers.missing.noul,
    confidence: answers.connector.confidence,
  };
}
