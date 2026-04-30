import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#curated-trips", label: "Curated trips" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Membership" },
  { href: "#faq", label: "FAQ" },
];

const COMPANY_LINKS = [
  { href: "/apply", label: "Apply" },
  { href: "/founders", label: "Founders" },
  { href: "/sign-in", label: "Sign in" },
  { href: "mailto:hello@tripcrew.app", label: "Contact" },
];

const LEGAL_LINKS = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/cookies", label: "Cookies" },
];

export function Footer() {
  return (
    <footer className="bg-ink text-cream border-t-2 border-cream/15">
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-20 md:py-24">
        <div className="grid grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12 md:gap-10">
          <div className="col-span-2 md:col-span-1 flex flex-col justify-between min-h-[180px]">
            <Link
              href="/"
              className="font-mono uppercase tracking-[0.18em] text-[13px] text-marketing-coral self-start"
            >
              Tripcrew
            </Link>
            <p className="font-serif italic text-[20px] md:text-[22px] leading-[1.25] text-cream max-w-[18ch]">
              Trips that leave the chat.
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-20 pt-6 border-t border-cream/15 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/65">
            © {new Date().getFullYear()} Tripcrew. Invite only.
          </p>
          <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/65 flex items-center gap-3">
            <Link
              href="/legal/privacy"
              className="hover:text-cream underline-offset-4 hover:underline"
            >
              Privacy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/legal/terms"
              className="hover:text-cream underline-offset-4 hover:underline"
            >
              Terms
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/legal/cookies"
              className="hover:text-cream underline-offset-4 hover:underline"
            >
              Cookies
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="font-mono uppercase tracking-[0.18em] text-[10px] text-cream/55 mb-5">
        {title}
      </p>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream hover:text-marketing-coral transition-colors duration-150"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
