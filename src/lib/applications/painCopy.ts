import type { ApplicationPain } from "@/lib/types";

const MIRROR: Record<ApplicationPain, string> = {
  dates: "You said dates never align.",
  booking: "You said nobody books anything.",
  money: "You said money gets weird.",
  plan: "You said the plan never gets made.",
  chaos: "You said your trips happen but feel chaotic.",
};

const EMAIL_OPENER: Record<ApplicationPain, string> = {
  dates: "You told us dates never align. We rebuilt that part first.",
  booking: "You told us nobody ever books anything. We fixed the booking handoff.",
  money: "You told us money gets weird. The ledger settles itself now.",
  plan: "You told us the plan never gets made. The AI drafts it for you.",
  chaos: "You told us trips happen but feel chaotic. We made them feel calm.",
};

export function painMirror(pain: ApplicationPain): string {
  return MIRROR[pain];
}

export function painEmailOpener(pain: ApplicationPain): string {
  return EMAIL_OPENER[pain];
}
