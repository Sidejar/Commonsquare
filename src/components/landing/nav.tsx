import Link from "next/link";
import { CS } from "@/lib/cs";
import { CSMark } from "@/components/cs/cs-mark";
import { CSButton } from "@/components/cs/cs-button";
import { CSCopy } from "./copy";

export function LandingNav() {
  return (
    <div className="flex items-center justify-between px-6 py-5 md:px-16 md:py-6">
      <Link href="/" className="flex items-center gap-3">
        <CSMark size={28} />
        <span
          className="font-sans"
          style={{
            fontWeight: 500,
            fontSize: 18,
            letterSpacing: "-0.025em",
            color: CS.ink,
          }}
        >
          commonsquare
        </span>
      </Link>
      <div className="hidden items-center gap-6 md:flex">
        <Link
          href="/topics"
          className="font-sans"
          style={{
            fontSize: 14,
            color: CS.ink,
            letterSpacing: "-0.01em",
          }}
        >
          Topics
        </Link>
        <Link
          href="/debates"
          className="font-sans"
          style={{
            fontSize: 14,
            color: CS.ink,
            letterSpacing: "-0.01em",
          }}
        >
          Debates
        </Link>
        {["Why", "Compass", "Square"].map((l) => (
          <a
            key={l}
            href={`#${l.toLowerCase()}`}
            className="font-sans"
            style={{
              fontSize: 14,
              color: CS.ink,
              letterSpacing: "-0.01em",
            }}
          >
            {l}
          </a>
        ))}
      </div>
      <Link href="/quiz">
        <CSButton size="sm" variant="ink">
          {CSCopy.nav.cta}
        </CSButton>
      </Link>
    </div>
  );
}
