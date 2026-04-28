import type { TeaserInputs, TeaserOutput } from "@/lib/types";

export type SendTeaserConfirmationInput = {
  email: string;
  draftId: string;
  resumeToken: string;
  slug: string;
  inputs: TeaserInputs;
  teaser: TeaserOutput;
};

// TODO: Task 1.7 implements the real Resend send.
export async function sendTeaserConfirmation(
  _params: SendTeaserConfirmationInput,
): Promise<void> {
  console.log("[teaser] confirmation email stub — implement in Task 1.7");
}
