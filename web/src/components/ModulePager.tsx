"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_LINKS, type SiteLink } from "@/components/site";

const ORDER = ["/m1", "/m2", "/m3", "/m4", "/m5", "/m6", "/india"];

/** Previous and next chapter at the foot of each chapter, so the seven read as one report. */
export function ModulePager() {
  const path = usePathname();
  const i = ORDER.indexOf(path);
  if (i < 0) return null;
  const prev = i > 0 ? SITE_LINKS.find((l) => l.href === ORDER[i - 1]) : SITE_LINKS.find((l) => l.href === "/journey");
  const next = i < ORDER.length - 1 ? SITE_LINKS.find((l) => l.href === ORDER[i + 1]) : SITE_LINKS.find((l) => l.href === "/concepts");
  const entry = (l: SiteLink | undefined, dir: "Previous" | "Next") =>
    l ? (
      <Link href={l.href} className={`entry block py-4 ${dir === "Next" ? "sm:text-right" : ""}`}>
        <span className="ui block text-[0.84rem] text-ink-soft">{dir}</span>
        <span className="entry-title serif mt-0.5 block text-[1.45rem] font-semibold leading-tight">
          {l.n ? `${l.n}. ` : ""}
          {l.label}
        </span>
        <span className="ui mt-0.5 block text-[0.9rem] text-ink-soft">{l.q}</span>
      </Link>
    ) : (
      <span />
    );
  return (
    <nav aria-label="Previous and next chapter" className="mx-auto max-w-[1180px] px-5 pt-10 sm:px-8">
      <div className="grid gap-2 border-y border-ink sm:grid-cols-2 sm:gap-8">
        {entry(prev, "Previous")}
        {entry(next, "Next")}
      </div>
    </nav>
  );
}
