"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark, SITE_LINKS } from "@/components/site";

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b border-rule/70 bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[var(--nav-h)] max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-ink no-underline" aria-label="Why Pay Anyone, home">
          <LogoMark />
          <span className="ui text-[1.12rem] font-bold tracking-tight">
            Why Pay Anyone<span className="text-ai">?</span>
          </span>
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-0.5 lg:flex">
          {SITE_LINKS.filter((l) => l.href !== "/").map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`ui whitespace-nowrap rounded-full px-3 py-1.5 text-[0.9rem] font-medium no-underline transition-colors ${
                isActive(l.href) ? "bg-ink text-white" : "text-ink-soft hover:bg-paper-2 hover:text-ink"
              }`}
            >
              {l.short}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="relative -mr-2 flex h-11 w-11 items-center justify-center rounded-full lg:hidden"
        >
          <span aria-hidden className="relative block h-4 w-6">
            <span className={`absolute left-0 h-[2.5px] w-6 rounded bg-ink transition-all duration-300 ${open ? "top-[7px] rotate-45" : "top-0"}`} />
            <span className={`absolute left-0 top-[7px] h-[2.5px] w-6 rounded bg-ink transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"}`} />
            <span className={`absolute left-0 h-[2.5px] w-6 rounded bg-ink transition-all duration-300 ${open ? "top-[7px] -rotate-45" : "top-[14px]"}`} />
          </span>
        </button>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="night on-night fixed inset-x-0 bottom-0 top-[var(--nav-h)] z-40 overflow-y-auto overscroll-contain px-5 pb-10 pt-4 lg:hidden"
      >
        <nav aria-label="All pages">
          <ul className="divide-y divide-white/10">
            {SITE_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`flex items-center gap-4 py-3.5 no-underline ${isActive(l.href) ? "text-white" : "text-on-night"}`}
                >
                  <span className="mono w-8 shrink-0 text-[0.85rem] text-ai-glow">{l.id ?? ""}</span>
                  <span className="min-w-0">
                    <span className="serif block text-[1.5rem] leading-tight">{l.label}</span>
                    <span className="ui block text-[0.86rem] leading-snug text-on-night-soft">{l.q}</span>
                  </span>
                  {isActive(l.href) && <span aria-hidden className="pulse-dot ml-auto h-2 w-2 shrink-0 rounded-full bg-human" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
