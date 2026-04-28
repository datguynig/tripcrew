import Link from "next/link";

type ChatMessage = {
  initials: string;
  name: string;
  time: string;
  body: string;
  alignment: "left" | "right";
  tone?: "muted";
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
    initials: "SM",
    name: "Sam",
    time: "Mon 19:48",
    body: "depends on dates tbh",
    alignment: "right",
  },
  {
    initials: "MO",
    name: "Mo",
    time: "Tue 09:11",
    body: "max £400 fwiw",
    alignment: "left",
  },
  {
    initials: "TM",
    name: "Tom",
    time: "Wed 22:17",
    body: "flights have doubled lol",
    alignment: "right",
  },
  {
    initials: "AS",
    name: "Ash",
    time: "Sat 11:03",
    body: "actually might bow out, niece's christening",
    alignment: "left",
  },
  {
    initials: "PR",
    name: "Priya",
    time: "Two weeks later",
    body: "…",
    alignment: "right",
    tone: "muted",
  },
];

export function PainResonance() {
  return (
    <section
      id="why-tripcrew"
      className="bg-cream text-ink border-y-2 border-ink"
    >
      <div className="mx-auto max-w-[1100px] px-6 sm:px-10 py-24 md:py-32">
        <div className="flex flex-col gap-5 mb-14 md:mb-20 max-w-[640px]">
          <p className="font-mono uppercase tracking-[0.22em] text-[11px] text-marketing-coral-deep">
            You've had this exact chat
          </p>
          <h2 className="font-serif text-[40px] md:text-[56px] leading-[1.02] tracking-[-0.025em]">
            Six friends. One chat. No trip.
          </h2>
          <p className="text-[17px] leading-[1.55] text-ink/70 max-w-[58ch]">
            Group trips don&apos;t die because no one wants to go. They die in
            the chat. The vibe-check loop. The deferred decision. The price
            shock. The first polite drop-out. We&apos;ve all been here.
          </p>
        </div>

        <div className="relative border-2 border-ink bg-cream p-5 sm:p-8 md:p-10">
          <ChatHeader />
          <ol className="flex flex-col gap-5 mt-6">
            {MESSAGES.map((message, index) => (
              <li key={`${message.initials}-${index}`}>
                <ChatRow message={message} index={index} />
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 md:mt-16 flex flex-col items-center gap-8 text-center">
          <p className="font-serif italic text-[28px] md:text-[36px] leading-[1.15] tracking-[-0.02em] max-w-[26ch]">
            Three months later, no one went.
          </p>
          <div className="h-[2px] w-12 bg-marketing-coral" />
          <p className="font-mono uppercase tracking-[0.22em] text-[12px] text-ink/85">
            Tripcrew turns the chat into a trip.
          </p>
          <Link
            href="/apply"
            className="inline-flex items-center justify-center bg-ink text-cream font-mono uppercase tracking-[0.18em] text-[12px] h-[52px] px-7 border-2 border-ink hover:bg-marketing-coral hover:border-marketing-coral transition-colors duration-150"
          >
            Apply for an invite →
          </Link>
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
            <span
              key={initials}
              aria-hidden="true"
              className="w-7 h-7 rounded-full bg-ink text-cream border-2 border-cream flex items-center justify-center font-mono uppercase tracking-[0.04em] text-[9px]"
            >
              {initials}
            </span>
          ))}
        </div>
        <div>
          <p className="font-mono uppercase tracking-[0.18em] text-[11px] text-ink">
            June trip · 6 people
          </p>
          <p className="font-mono uppercase tracking-[0.22em] text-[9px] text-ink/80">
            14 unread · last seen Tue
          </p>
        </div>
      </div>
      <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-ink/80">
        Group chat
      </p>
    </div>
  );
}

function ChatRow({
  message,
  index,
}: {
  message: ChatMessage;
  index: number;
}) {
  const fade = index >= 4 ? "opacity-80" : "opacity-100";
  const isRight = message.alignment === "right";
  const wrapperJustify = isRight ? "justify-end" : "justify-start";
  const bubbleBg = isRight
    ? "bg-ink text-cream"
    : "bg-cream text-ink border-2 border-ink";
  const bubbleTone =
    message.tone === "muted"
      ? "italic text-ink/80 bg-cream border-2 border-dashed border-ink/40"
      : "";

  return (
    <div className={`flex ${wrapperJustify} ${fade}`}>
      <div
        className={`flex items-end gap-3 max-w-[78%] ${
          isRight ? "flex-row-reverse" : ""
        }`}
      >
        <Avatar initials={message.initials} muted={message.tone === "muted"} />
        <div className={`flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
          <div className="flex items-center gap-2 font-mono uppercase tracking-[0.18em] text-[9px] text-ink/80">
            <span className="text-ink">{message.name}</span>
            <span aria-hidden="true">·</span>
            <span>{message.time}</span>
          </div>
          <div
            className={`px-4 py-3 text-[14px] sm:text-[15px] leading-[1.45] ${bubbleBg} ${bubbleTone}`}
          >
            {message.body}
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({
  initials,
  muted = false,
}: {
  initials: string;
  muted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={
        "shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-mono uppercase tracking-[0.04em] text-[10px] " +
        (muted
          ? "bg-cream text-ink/80 border-2 border-dashed border-ink/40"
          : "bg-ink text-cream")
      }
    >
      {initials}
    </span>
  );
}
