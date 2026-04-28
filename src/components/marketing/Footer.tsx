import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#sample-trips", label: "Sample trips" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const COMPANY_LINKS = [
  { href: "/apply", label: "Apply for invite" },
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
    <footer className="bg-ink text-cream border-t-2 border-cream/20">
      <div className="mx-auto max-w-[1280px] px-6 sm:px-10 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr] gap-12">
          <div>
            <Link
              href="/"
              className="font-mono uppercase tracking-[0.22em] text-[14px] text-marketing-coral"
            >
              Tripcrew
            </Link>
            <p className="mt-4 font-serif italic text-[18px] leading-[1.4] text-cream/85 max-w-[28ch]">
              Trips that make it out of the group chat.
            </p>
            <p className="mt-6 font-mono uppercase tracking-[0.22em] text-[10px] text-cream/70">
              Built in London.
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-14 pt-6 border-t border-cream/15 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/70">
            © {new Date().getFullYear()} Tripcrew. Invite only.
          </p>
          <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-cream/70 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="w-[6px] h-[6px] rounded-full bg-marketing-coral"
            />
            All systems good
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
      <p className="font-mono uppercase tracking-[0.22em] text-[10px] text-marketing-coral mb-4">
        {title}
      </p>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="font-mono uppercase tracking-[0.18em] text-[11px] text-cream/75 hover:text-cream underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
