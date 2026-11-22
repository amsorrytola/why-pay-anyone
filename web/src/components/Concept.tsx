"use client";

/*
  <C id="jevons">Jevons paradox</C>

  Inline glossary term. The text gets a dotted underline. On hover, keyboard focus or tap, a small popover
  shows the concept's name, definition and an example from this project, with a link to its entry on the
  concept map (/concepts#<id>). An unknown id renders the children as plain text.

  How it works
  - The popover is always in the DOM (hidden with visibility) and is referenced by aria-describedby, so screen
    readers read the definition when the term gets focus, and the link inside it can be reached with Tab
    while it is open.
  - It is position: fixed and placed by script when it opens, so it never moves the surrounding text
    (no layout shift) and is not clipped by scrolling tables.
  - Mouse and pen: hover opens it (short delay), leaving closes it, and the pointer can move onto it.
    Keyboard: focus opens it, Enter or Space toggles it. Touch: tap toggles it, tapping elsewhere closes it.
    Escape closes it in every case.
*/

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { CONCEPT_BY_ID, GROUP_BY_ID, type Concept } from "@/content/concepts";

const OPEN_DELAY = 100;
const CLOSE_DELAY = 220;

type PointerKind = "mouse" | "pen" | "touch" | "key";

export function C({ id, children }: { id: string; children: ReactNode }) {
  const concept = CONCEPT_BY_ID.get(id);
  if (!concept) return <>{children}</>;
  return <Term concept={concept}>{children}</Term>;
}

export default C;

function Term({ concept, children }: { concept: Concept; children: ReactNode }) {
  const popId = useId();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef<PointerKind>("key");

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  // Place the popover under the term (or above it when there is no room), kept inside the viewport.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    const rects = trigger.getClientRects();
    const r = rects.length > 0 ? rects[0] : trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    const gap = 6;
    const margin = 8;
    const left = Math.min(Math.max(margin, r.left), Math.max(margin, vw - w - margin));
    let top = r.bottom + gap;
    if (top + h > vh - margin && r.top - gap - h >= margin) top = r.top - gap - h;
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  // While open: Escape closes (also when only the mouse is over it), and a press outside closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const wrap = wrapRef.current;
      if (wrap && document.activeElement && wrap.contains(document.activeElement) && document.activeElement !== triggerRef.current) {
        triggerRef.current?.focus({ preventScroll: true });
      }
      setOpen(false);
    };
    const onDown = (e: globalThis.PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  useEffect(() => clearTimers, [clearTimers]);

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    window.clearTimeout(closeTimer.current);
    window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      // Keep it open if the keyboard focus is inside (the reader tabbed to it).
      const a = document.activeElement;
      if (wrapRef.current && a && wrapRef.current.contains(a) && a.matches(":focus-visible")) return;
      setOpen(false);
    }, CLOSE_DELAY);
  };

  const onFocus = (e: FocusEvent) => {
    // Only keyboard focus opens it. A tap also focuses, and would otherwise open and then toggle shut.
    if ((e.target as HTMLElement).matches(":focus-visible")) {
      window.clearTimeout(closeTimer.current);
      setOpen(true);
    }
  };

  const onBlur = (e: FocusEvent) => {
    if (lastPointer.current === "touch") return; // touch is closed by a press outside
    const next = e.relatedTarget as Node | null;
    if (!next || !wrapRef.current?.contains(next)) setOpen(false);
  };

  const onTriggerPointerDown = (e: PointerEvent) => {
    lastPointer.current = e.pointerType === "touch" ? "touch" : e.pointerType === "pen" ? "pen" : "mouse";
  };

  const onTriggerClick = () => {
    if (lastPointer.current === "mouse") setOpen(true); // the hover already opened it; a click keeps it open
    else setOpen((o) => !o);
  };

  const onTriggerKeyDown = (e: KeyboardEvent) => {
    lastPointer.current = "key";
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  const onLinkClick = (e: MouseEvent<HTMLAnchorElement>) => {
    setOpen(false);
    // Already on the concept map: change the hash, which the map listens for, instead of navigating.
    if (pathname === "/concepts") {
      e.preventDefault();
      window.location.hash = concept.id;
    }
  };

  const where = concept.modules.map((m) => GROUP_BY_ID.get(m)?.id ?? m).join(", ");

  return (
    <span ref={wrapRef} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocus={onFocus} onBlur={onBlur}>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-describedby={popId}
        onPointerDown={onTriggerPointerDown}
        onClick={onTriggerClick}
        onKeyDown={onTriggerKeyDown}
        className={`cursor-help rounded-[2px] underline decoration-ai decoration-dotted decoration-[1.5px] underline-offset-[3px] hover:bg-ai-soft/70 ${open ? "bg-ai-soft/70" : ""}`}
      >
        {children}
      </span>
      <span
        ref={popRef}
        id={popId}
        data-open={open ? "true" : "false"}
        className="fixed z-50 block w-[26rem] max-w-[calc(100vw-1rem)] rounded-[6px] border border-rule bg-surface p-3.5 text-left text-[1rem] font-normal not-italic leading-snug tracking-normal text-ink shadow-[0_8px_30px_rgba(17,26,53,0.18)]"
        style={
          open
            ? { visibility: "visible", opacity: 1, transition: "opacity 0.12s ease" }
            : { visibility: "hidden", opacity: 0, transition: "opacity 0.12s ease, visibility 0s linear 0.12s" }
        }
      >
        <span className="ui block text-[1.05rem] font-bold leading-tight">{concept.name}</span>
        <span className="ui mt-0.5 block text-[0.8rem] text-ink-faint">
          {concept.kind === "modelled" ? "Modelled" : "Explained only"}, {where}
        </span>
        <span className="mt-2 block text-[0.95rem]">{concept.definition}</span>
        <span className="mt-2 block text-[0.9rem] text-ink-soft">
          <span className="ui font-semibold text-ink">In this project: </span>
          {concept.example}
        </span>
        <span className="ui mt-2.5 block text-[0.9rem]">
          <Link href={`/concepts#${concept.id}`} onClick={onLinkClick} className="text-ai-deep underline">
            See it on the concept map
          </Link>
        </span>
      </span>
    </span>
  );
}
