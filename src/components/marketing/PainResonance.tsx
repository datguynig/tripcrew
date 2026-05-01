import Link from "next/link";

import { CountUp, RevealOnView } from "@/components/motion";

type ChatMessage = {
  initials: string;
  name: string;
  time: string;
  body: string;
  alignment: "left" | "right";
};

const MESSAGES: ChatMessage[] = [
  {
    initials: "NA",
    name: "Nia",
    time: "Mon 19:42",
    body: "anyone free in june",
    alignment: "left",
  },
  {
    initials: "TM",
    name: "Tom",
    time: "Wed 22:17",
    body: "i'm in. who's booking?",
    alignment: "right",
  },
];

export function PainResonance() {
  return (
    <section
      id="why-yenkoh"
      className="bg-cream text-ink border-y-2 border-ink"
    >
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-24 md:py-32">
        <RevealOnView className="flex flex-col gap-6 mb-16 md:mb-20 max-w-[760px]">
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
            You know how this ends
          </p>
          <h2 className="font-serif text-[44px] md:text-[64px] leading-[1.0] tracking-[-0.025em]">
            Six friends. One chat.{" "}
            <span className="font-serif italic">
              Most trips never leave it.
            </span>
          </h2>
        </RevealOnView>

        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-12 md:gap-16 items-start">
          <RevealOnView
            className="border-2 border-ink bg-cream p-5 sm:p-7 md:p-8"
            delay={0.08}
          >
            <ChatHeader />
            <ol className="flex flex-col gap-5 mt-6">
              {MESSAGES.map((message, index) => (
                <RevealOnView
                  as="li"
                  key={`${message.initials}-${index}`}
                  delay={0.28 + index * 0.32}
                  amount={0.45}
                >
                  <ChatRow message={message} />
                </RevealOnView>
              ))}
            </ol>
            <RevealOnView delay={1.15} amount={0.4}>
              <ReadReceipt />
            </RevealOnView>
          </RevealOnView>

          <div className="flex flex-col gap-8">
            <RevealOnView delay={0.18}>
              <Diagnosis />
            </RevealOnView>
            <RevealOnView
              className="border-t-2 border-ink/15 pt-7 flex flex-col gap-4"
              delay={0.28}
            >
              <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink">
                Yenkoh turns the chat into a trip.
              </p>
              <Link
                href="/apply"
                className="self-start inline-flex items-center justify-center bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-6 border-2 border-ink hover:bg-marketing-coral hover:border-marketing-coral transition-colors duration-150"
              >
                Apply for an invite →
              </Link>
            </RevealOnView>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatHeader() {
  return (
    <div className="flex items-center justify-between gap-4 pb-4 border-b-2 border-ink/15">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {["NA", "SM", "TM"].map((initials) => (
            <HeaderAvatar key={initials} initials={initials} />
          ))}
        </div>
        <div>
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink">
            June trip · 6 people
          </p>
          <p className="font-mono uppercase tracking-[0.18em] text-[9px] text-ink/65">
            <CountUp to={14} /> unread · last seen Tue
          </p>
        </div>
      </div>
      <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65">
        Group chat
      </p>
    </div>
  );
}

function ChatRow({ message }: { message: ChatMessage }) {
  const isRight = message.alignment === "right";
  const wrapperJustify = isRight ? "justify-end" : "justify-start";
  const bubbleBg = isRight
    ? "bg-ink text-cream"
    : "bg-cream text-ink border-2 border-ink";

  return (
    <div className={`flex ${wrapperJustify}`}>
      <div
        className={`flex items-end gap-3 max-w-[78%] ${
          isRight ? "flex-row-reverse" : ""
        }`}
      >
        <Avatar initials={message.initials} />
        <div className={`flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
          <div className="flex items-center gap-2 font-mono uppercase tracking-[0.18em] text-[9px] text-ink/65">
            <span className="text-ink">{message.name}</span>
            <span aria-hidden="true">·</span>
            <span>{message.time}</span>
          </div>
          <div className={`px-4 py-3 text-[14px] sm:text-[15px] leading-[1.45] ${bubbleBg}`}>
            {message.body}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadReceipt() {
  return (
    <div className="mt-6 ml-auto max-w-[320px] flex flex-col items-end gap-1 border-t border-ink/15 pt-4">
      <p className="font-mono uppercase tracking-[0.18em] text-[9px] text-ink/65">
        Priya · seen Tue 14:42 · never replied
      </p>
      <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink mt-1">
        No new messages for 14 days.
      </p>
    </div>
  );
}

function Diagnosis() {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-marketing-coral-deep">
        The diagnosis
      </p>
      <p className="font-serif text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-ink max-w-[20ch]">
        Group trips die at{" "}
        <span className="font-serif italic">&ldquo;who&rsquo;s booking?&rdquo;</span>
      </p>
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0 w-9 h-9 flex items-center justify-center font-mono uppercase tracking-[0.04em] text-[10px] bg-marketing-coral text-ink border-2 border-ink"
    >
      {initials}
    </span>
  );
}

function HeaderAvatar({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="w-7 h-7 bg-marketing-coral text-ink border-2 border-cream flex items-center justify-center font-mono uppercase tracking-[0.04em] text-[9px]"
    >
      {initials}
    </span>
  );
}
