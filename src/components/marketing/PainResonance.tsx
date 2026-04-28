import Image from "next/image";
import Link from "next/link";

import chatAvatarsRaw from "@/lib/marketing/chatAvatars.json";

type ChatAvatar = {
  photoUrl: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
};

const CHAT_AVATARS = chatAvatarsRaw as Record<string, ChatAvatar | null>;

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
          <ReadReceipt />
        </div>

        <EvidenceRow />

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
            <HeaderAvatar key={initials} initials={initials} />
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
  const fade = index >= 4 ? "opacity-85" : "opacity-100";
  const isRight = message.alignment === "right";
  const wrapperJustify = isRight ? "justify-end" : "justify-start";
  const bubbleBg = isRight
    ? "bg-ink text-cream"
    : "bg-cream text-ink border-2 border-ink";

  return (
    <div className={`flex ${wrapperJustify} ${fade}`}>
      <div
        className={`flex items-end gap-3 max-w-[78%] ${
          isRight ? "flex-row-reverse" : ""
        }`}
      >
        <Avatar initials={message.initials} />
        <div className={`flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
          <div className="flex items-center gap-2 font-mono uppercase tracking-[0.18em] text-[9px] text-ink/80">
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

function EvidenceRow() {
  return (
    <div className="mt-8 md:mt-10">
      <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-ink/65 mb-5">
        This isn't just your crew.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 border-2 border-ink/15">
        <Stat
          figure="1 in 5"
          body="friend trips ends a friendship over money."
          attr="Experian, 2024"
        />
        <Stat
          figure="73%"
          body="of trip planners list affordability as the top stressor."
          attr="Family Travel Association, 2025"
          bordered
        />
      </div>
    </div>
  );
}

function Stat({
  figure,
  body,
  attr,
  bordered = false,
}: {
  figure: string;
  body: string;
  attr: string;
  bordered?: boolean;
}) {
  return (
    <div
      className={
        "p-6 sm:p-7 flex flex-col gap-3 " +
        (bordered ? "sm:border-l-2 sm:border-ink/15 border-t-2 sm:border-t-0 border-ink/15" : "")
      }
    >
      <p className="font-serif text-[36px] md:text-[44px] leading-none tracking-[-0.025em]">
        {figure}
      </p>
      <p className="text-[14px] leading-[1.5] text-ink/80 max-w-[28ch]">
        {body}
      </p>
      <p className="font-mono uppercase tracking-[0.22em] text-[9px] text-ink/65 mt-auto">
        {attr}
      </p>
    </div>
  );
}

function ReadReceipt() {
  return (
    <div className="mt-6 ml-auto max-w-[300px] flex flex-col items-end gap-2 border-t border-ink/15 pt-4">
      <p className="font-mono uppercase tracking-[0.18em] text-[9px] text-ink/65">
        Priya · seen Tue 14:42 · never replied
      </p>
      <p className="font-serif italic text-[16px] leading-[1.3] text-ink text-right">
        No new messages for 14 days.
      </p>
    </div>
  );
}

function Avatar({ initials }: { initials: string }) {
  const avatar = CHAT_AVATARS[initials];
  if (avatar) {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-ink relative"
      >
        <Image
          src={avatar.photoUrl}
          alt=""
          fill
          sizes="36px"
          className="object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-mono uppercase tracking-[0.04em] text-[10px] bg-ink text-cream"
    >
      {initials}
    </span>
  );
}

function HeaderAvatar({ initials }: { initials: string }) {
  const avatar = CHAT_AVATARS[initials];
  if (avatar) {
    return (
      <span
        aria-hidden="true"
        className="w-7 h-7 rounded-full overflow-hidden border-2 border-cream relative"
      >
        <Image
          src={avatar.photoUrl}
          alt=""
          fill
          sizes="28px"
          className="object-cover"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="w-7 h-7 rounded-full bg-ink text-cream border-2 border-cream flex items-center justify-center font-mono uppercase tracking-[0.04em] text-[9px]"
    >
      {initials}
    </span>
  );
}
