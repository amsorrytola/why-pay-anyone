"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SITE_LINKS } from "@/components/site";

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
    <header className="sticky top-0 z-50 border-b border-ink bg-paper">
      <div className="mx-auto flex h-[var(--nav-h)] max-w-[1180px] items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="flex min-w-0 items-baseline gap-3 text-ink no-underline hover:text-ink" aria-label="Why Pay Anyone, home">
          <span className="serif whitespace-nowrap text-[1.28rem] font-semibold tracking-[-0.01em]">Why Pay Anyone?</span>
          <span className="ui hidden truncate text-[0.84rem] text-ink-soft 2xl:inline">The economics of cheap intelligence</span>
        </Link>

        <nav aria-label="Chapters" className="hidden items-center gap-3 lg:flex xl:gap-5">
          {SITE_LINKS.filter((l) => l.href !== "/").map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`ui whitespace-nowrap py-1 text-[0.84rem] font-semibold no-underline xl:text-[0.9rem] ${
                isActive(l.href) ? "text-ink underline decoration-2 underline-offset-[7px]" : "text-ink-soft hover:text-ink"
              }`}
            >
              {l.n && l.id ? <span className="mr-1 text-ink-faint">{l.n}</span> : null}
              {l.short}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="ui -mr-2 flex h-11 items-center gap-2 px-2 text-[0.92rem] font-semibold text-ink lg:hidden"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            {open ? (
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            ) : (
              <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
            )}
          </svg>
          {open ? "Close" : "Contents"}
        </button>
      </div>

      <div id="mobile-menu" hidden={!open} className="fixed inset-x-0 bottom-0 top-[var(--nav-h)] z-40 overflow-y-auto overscroll-contain bg-paper px-5 pb-12 pt-2 lg:hidden">
        <nav aria-label="Contents">
          <ul>
            {SITE_LINKS.map((l) => (
              <li key={l.href} className="border-b border-rule">
                <Link href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className="entry flex items-baseline gap-4 py-3.5">
                  <span className="serif w-6 shrink-0 text-[1.2rem] font-semibold text-human">{l.n ?? ""}</span>
                  <span className="min-w-0">
                    <span className={`entry-title serif block text-[1.35rem] leading-tight ${isActive(l.href) ? "font-semibold underline decoration-2 underline-offset-4" : ""}`}>{l.label}</span>
                    <span className="ui block text-[0.88rem] leading-snug text-ink-soft">{l.q}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
