import { TypeSafeClient, noul } from "@typesafe-ai/sdk";
import type { GateDecision } from "./types.ts";

let _jev: TypeSafeClient | null = null;
function jev(): TypeSafeClient {
  return (_jev ??= new TypeSafeClient({ defaultModel: "jev-latest" }));
}

const hasJev = () => Boolean(process.env.TYPESAFE_API_KEY);
const UPSET_T = 0.35;
const COMMITS_T = 0.5;

export async function gate(
  originalRequest: string,
  draftOrAction: string,
): Promise<GateDecision> {
  if (!hasJev()) {
    return { upset: 0, commits: 0, risk: "low", needsApproval: false };
  }
  const { answers } = await jev().systemOne({
    state: {
      user_request: originalRequest,
      action_about_to_happen: draftOrAction,
    },
    questions: {
      upset: noul(
        "Sending or posting this exactly as written could confuse, upset or offend the recipient (tone off, wrong facts, inappropriate for the relationship, missing context the reader needs).",
      ),
      commits: noul(
        "This action commits the user to money, a specific date or time, or a concrete promise (books a meeting, sends payment, replies yes to a request, agrees to a deadline).",
      ),
    },
  });

  const upset = answers.upset.noul;
  const commits = answers.commits.noul;
  const risk: GateDecision["risk"] =
    upset > 0.6 || commits > 0.7 ? "high" : upset > UPSET_T || commits > COMMITS_T ? "medium" : "low";

  return {
    upset,
    commits,
    risk,
    needsApproval: upset > UPSET_T || commits > COMMITS_T,
  };
}
