"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SITE_LINKS } from "@/components/site";

const ORDER = ["/m1", "/m2", "/m3", "/m4", "/m5", "/m6", "/india"];

/** Previous and next lab at the foot of each module page, so the six labs read as one path. */
export function ModulePager() {
  const path = usePathname();
  const i = ORDER.indexOf(path);
  if (i < 0) return null;
  const prev = i > 0 ? SITE_LINKS.find((l) => l.href === ORDER[i - 1]) : SITE_LINKS.find((l) => l.href === "/");
  const next = i < ORDER.length - 1 ? SITE_LINKS.find((l) => l.href === ORDER[i + 1]) : SITE_LINKS.find((l) => l.href === "/concepts");
  const card = (l: (typeof SITE_LINKS)[number] | undefined, dir: "Previous" | "Next") =>
    l ? (
      <Link href={l.href} className={`tile panel block p-5 no-underline sm:p-6 ${dir === "Next" ? "sm:text-right" : ""}`}>
        <span className="ui text-[0.82rem] font-semibold text-ink-faint">{dir}</span>
        <span className="serif mt-1 block text-[1.6rem] leading-tight text-ink">
          {l.id ? <span className="mono mr-2 text-[0.95rem] text-ai">{l.id}</span> : null}
          {l.label}
        </span>
        <span className="ui mt-1 block text-[0.9rem] text-ink-soft">{l.q}</span>
      </Link>
    ) : null;
  return (
    <nav aria-label="Previous and next lab" className="mx-auto grid max-w-[1200px] gap-4 px-5 pt-6 sm:grid-cols-2 sm:px-8">
      {card(prev, "Previous")}
      {card(next, "Next")}
    </nav>
  );
}
