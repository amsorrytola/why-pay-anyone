"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "The question" },
  { href: "/m1", label: "Prices", id: "M1" },
  { href: "/m2", label: "Usage", id: "M2" },
  { href: "/m3", label: "Adoption", id: "M3" },
  { href: "/m4", label: "Wages", id: "M4" },
  { href: "/m5", label: "Markets", id: "M5" },
  { href: "/m6", label: "Growth and policy", id: "M6" },
  { href: "/india", label: "India" },
  { href: "/concepts", label: "Concepts" },
  { href: "/data", label: "Data" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center gap-6 px-5 py-3">
        <Link href="/" className="ui shrink-0 text-[1.15rem] font-bold tracking-tight text-ink no-underline">
          Why Pay Anyone<span className="text-ai">?</span>
        </Link>
        <nav aria-label="Sections" className="ui -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[0.95rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 no-underline transition-colors ${
                  active ? "bg-ink text-paper" : "text-ink-soft hover:bg-rule/60 hover:text-ink"
                }`}
              >
                {l.id ? <span className="mr-1.5 opacity-60">{l.id}</span> : null}
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
