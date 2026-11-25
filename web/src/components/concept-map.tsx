"use client";

/*
  The interactive concept map (page: /concepts).

  - Map view (wide screens): one lane per module, concepts as nodes. Selecting a node draws lines to its
    related concepts and opens a details panel. Node positions are computed from fixed sizes, so the SVG
    lines need no DOM measuring except the container width.
  - List view (always on narrow screens, optional on wide ones): every concept with its definition, as a
    plain list that works with keyboard and screen readers.
  - Filters: module, era, modelled or explained, and a text search.
  - The selected concept lives in the URL hash (#jevons), so it can be linked to.
  - The server renders the list view; the map appears once the page has loaded on a wide screen.
*/

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { Caveat } from "@/components/ui";
import { CONCEPTS, CONCEPT_BY_ID, GROUPS, GROUP_BY_ID, MODULES, RELATED_BY_ID, type Concept, type Era, type GroupId, type GroupInfo, type Kind } from "@/content/concepts";

/* ------------------------------------------------------------------ constants */

const NODE_H = 52;
const ROW_GAP = 6;
const HEADER_H = 56;
const HEADER_GAP = 8;
const LANE_GAP = 10;
const NARROW_QUERY = "(max-width: 959px)";

const TONE: Record<GroupId, { line: string; deep: string }> = {
  Foundations: { line: "var(--ink-faint)", deep: "var(--ink-soft)" },
  M1: { line: "var(--ai)", deep: "var(--ai-deep)" },
  M2: { line: "var(--ai)", deep: "var(--ai-deep)" },
  M3: { line: "var(--human)", deep: "var(--human-deep)" },
  M4: { line: "var(--human)", deep: "var(--human-deep)" },
  M5: { line: "var(--owner)", deep: "var(--owner)" },
  M6: { line: "var(--owner)", deep: "var(--owner)" },
  India: { line: "var(--ok)", deep: "var(--ok)" },
};

const ERA_TEXT: Record<Era, string> = { classic: "Classic idea (before 1970)", modern: "Modern idea (1970 on)" };
const KIND_TEXT: Record<Kind, string> = { modelled: "Modelled", explained: "Explained only" };

/** Text used by the search box, built once. */
const HAYSTACK: ReadonlyMap<string, string> = new Map(
  CONCEPTS.map((c) => [c.id, [c.name, c.short ?? "", c.definition, c.example, c.id.replace(/-/g, " ")].join(" ").toLowerCase()]),
);

function groupLabel(g: GroupInfo) {
  if (g.id === "Foundations" || g.id === "India") return g.name;
  return `${g.id} ${g.short}`;
}

function pageLabel(route: string) {
  const m = MODULES.find((x) => x.route === route);
  return m ? (m.id === "India" ? "India page" : `${m.id} ${m.short} page`) : route;
}

/* ------------------------------------------------------------------ URL hash as the selection */

const HASH_EVENT = "concept-hash";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  window.addEventListener(HASH_EVENT, cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
    window.removeEventListener(HASH_EVENT, cb);
  };
}

function getHash() {
  const h = window.location.hash.slice(1);
  try {
    return decodeURIComponent(h);
  } catch {
    return h;
  }
}

function setHash(id: string | null) {
  const url = window.location.pathname + window.location.search + (id ? `#${id}` : "");
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new Event(HASH_EVENT));
}

function useNarrow() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(NARROW_QUERY);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(NARROW_QUERY).matches,
    () => true,
  );
}

/* ------------------------------------------------------------------ small pieces */

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`ui min-h-9 rounded-[3px] border px-3 py-1 text-[0.9rem] transition-colors ${
        pressed ? "border-ink bg-ink text-paper" : "border-rule bg-surface text-ink hover:border-ai hover:bg-ai-soft"
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <span className="ui w-full text-[0.85rem] font-semibold text-ink-soft sm:w-[9.5rem]" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone?: "ink" }) {
  return (
    <span className={`ui inline-block rounded-[3px] border px-2.5 py-0.5 text-[0.8rem] ${tone === "ink" ? "border-ink bg-ink text-paper" : "border-rule bg-paper text-ink-soft"}`}>{children}</span>
  );
}

/* ------------------------------------------------------------------ map view */

type Lane = { group: GroupInfo; items: Concept[] };

function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(Math.round(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function edgePath(a: { x: number; y: number; lane: number }, b: { x: number; y: number; lane: number }, w: number) {
  const ay = a.y + NODE_H / 2;
  const by = b.y + NODE_H / 2;
  if (a.lane === b.lane) {
    const x = a.x + w;
    const bulge = LANE_GAP * 1.6;
    return { d: `M${x},${ay} C${x + bulge},${ay} ${x + bulge},${by} ${x},${by}`, x1: x, y1: ay, x2: x, y2: by };
  }
  const right = b.lane > a.lane;
  const x1 = right ? a.x + w : a.x;
  const x2 = right ? b.x : b.x + w;
  const dx = Math.max(8, Math.abs(x2 - x1) * 0.5) * (right ? 1 : -1);
  return { d: `M${x1},${ay} C${x1 + dx},${ay} ${x2 - dx},${by} ${x2},${by}`, x1, y1: ay, x2, y2: by };
}

function MapView({
  lanes,
  selectedId,
  visibleIds,
  onSelect,
  onClear,
}: {
  lanes: Lane[];
  selectedId: string | null;
  visibleIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [rootRef, width] = useElementWidth();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const refocusPanel = useRef(false);
  const [rovingId, setRovingId] = useState<string | null>(null);

  const n = lanes.length;
  const rows = Math.max(1, ...lanes.map((l) => l.items.length));
  const laneW = n > 0 && width > 0 ? (width - (n - 1) * LANE_GAP) / n : 0;
  const bodyTop = HEADER_H + HEADER_GAP;
  const height = bodyTop + rows * (NODE_H + ROW_GAP) - ROW_GAP;

  const geo = useMemo(() => {
    const m = new Map<string, { x: number; y: number; lane: number; row: number }>();
    lanes.forEach((l, li) => l.items.forEach((c, ri) => m.set(c.id, { x: li * (laneW + LANE_GAP), y: bodyTop + ri * (NODE_H + ROW_GAP), lane: li, row: ri })));
    return m;
  }, [lanes, laneW, bodyTop]);

  const selected = selectedId ? CONCEPT_BY_ID.get(selectedId) ?? null : null;
  const relatedIds = useMemo(() => (selectedId ? RELATED_BY_ID.get(selectedId) ?? [] : []), [selectedId]);
  const relatedSet = useMemo(() => new Set(relatedIds), [relatedIds]);

  const firstId = lanes.find((l) => l.items.length > 0)?.items[0]?.id ?? null;
  const tabbable = rovingId && geo.has(rovingId) ? rovingId : selectedId && geo.has(selectedId) ? selectedId : firstId;

  // Keep the selected node on screen when it is chosen from the details panel, the URL or the keyboard.
  useEffect(() => {
    if (!selectedId) return;
    rootRef.current?.querySelector<HTMLElement>(`[data-node="${selectedId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, rootRef]);

  // After choosing a related concept in the panel, put focus on the panel heading so keyboard and screen reader users stay in it.
  useEffect(() => {
    if (refocusPanel.current) {
      refocusPanel.current = false;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [selectedId]);

  const focusNode = (id: string | undefined) => {
    if (!id) return;
    rootRef.current?.querySelector<HTMLElement>(`[data-node="${id}"]`)?.focus();
  };

  const onNodeKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const at = geo.get(id);
    if (!at) return;
    const items = lanes[at.lane].items;
    let target: string | undefined;
    switch (e.key) {
      case "ArrowDown":
        target = items[at.row + 1]?.id;
        break;
      case "ArrowUp":
        target = items[at.row - 1]?.id;
        break;
      case "Home":
        target = items[0]?.id;
        break;
      case "End":
        target = items[items.length - 1]?.id;
        break;
      case "ArrowRight":
      case "ArrowLeft": {
        const step = e.key === "ArrowRight" ? 1 : -1;
        for (let li = at.lane + step; li >= 0 && li < lanes.length; li += step) {
          const other = lanes[li].items;
          if (other.length > 0) {
            target = other[Math.min(at.row, other.length - 1)].id;
            break;
          }
        }
        break;
      }
      default:
        return;
    }
    e.preventDefault();
    focusNode(target);
  };

  const closePanel = () => {
    const id = selectedId;
    onClear();
    if (id) focusNode(id);
  };

  const lines = useMemo(() => {
    if (!selectedId || laneW <= 0) return [];
    const a = geo.get(selectedId);
    if (!a) return [];
    return relatedIds.flatMap((rid) => {
      const b = geo.get(rid);
      return b ? [{ id: rid, ...edgePath(a, b, laneW) }] : [];
    });
  }, [selectedId, relatedIds, geo, laneW]);

  const hiddenByFilter = selected && !visibleIds.has(selected.id);

  return (
    <div
      onKeyDown={(e) => {
        if (e.key === "Escape" && selectedId) {
          e.stopPropagation();
          closePanel();
        }
      }}
    >
      <div ref={rootRef} className="relative">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, columnGap: LANE_GAP }}>
          {lanes.map(({ group, items }) => {
            const tone = TONE[group.id];
            const headId = `lane-${group.id}`;
            return (
              <section key={group.id} aria-labelledby={headId} className="min-w-0">
                <h3 id={headId} className="ui overflow-hidden border-b-[3px] pb-1" style={{ height: HEADER_H, borderColor: tone.line }}>
                  <span className="block text-[0.74rem] font-semibold leading-tight" style={{ color: tone.deep }}>
                    {group.id === "Foundations" ? "Used throughout" : group.id}
                  </span>
                  <span className="block text-[0.92rem] font-bold leading-[1.1]">{group.id === "Foundations" ? "Foundations" : group.short}</span>
                </h3>
                <ul className="flex flex-col" style={{ marginTop: HEADER_GAP, gap: ROW_GAP }}>
                  {items.map((c) => {
                    const isSel = c.id === selectedId;
                    const isRel = relatedSet.has(c.id);
                    const explained = c.kind === "explained";
                    return (
                      <li key={c.id} style={{ height: NODE_H }}>
                        <button
                          type="button"
                          data-node={c.id}
                          tabIndex={tabbable === c.id ? 0 : -1}
                          aria-pressed={isSel}
                          onClick={() => (isSel ? onClear() : onSelect(c.id))}
                          onFocus={() => setRovingId(c.id)}
                          onKeyDown={(e) => onNodeKey(e, c.id)}
                          style={{ borderLeftColor: tone.line }}
                          className={`ui flex h-full w-full scroll-mb-80 scroll-mt-28 items-center rounded-[6px] border border-l-[5px] px-2 py-1 text-left text-[0.78rem] font-semibold leading-[1.15] transition-colors ${
                            isSel
                              ? "border-ink bg-ink text-paper"
                              : isRel
                                ? "border-ink bg-ai-soft text-ink ring-1 ring-ink"
                                : explained
                                  ? "border-rule bg-paper text-ink hover:border-ink"
                                  : "border-rule bg-surface text-ink hover:border-ink"
                          }`}
                        >
                          <span className="line-clamp-3">
                            {explained && <span aria-hidden="true">◇ </span>}
                            {c.short ?? c.name}
                            {explained && <span className="sr-only">, explained only</span>}
                            {isRel && selected && <span className="sr-only">, related to {selected.short ?? selected.name}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {items.length === 0 && <li className="ui text-[0.82rem] text-ink-faint">No matches</li>}
                </ul>
              </section>
            );
          })}
        </div>

        {width > 0 && (
          <svg className="pointer-events-none absolute left-0 top-0 z-10" width={width} height={height} aria-hidden="true" focusable="false">
            {lines.map((l) => (
              <g key={l.id} fill="none" strokeLinecap="round">
                <path d={l.d} stroke="#ffffff" strokeWidth={4.5} opacity={0.85} />
                <path d={l.d} stroke="var(--ink)" strokeWidth={1.75} opacity={0.8} />
                <circle cx={l.x1} cy={l.y1} r={3.2} fill="var(--ink)" />
                <circle cx={l.x2} cy={l.y2} r={3.2} fill="var(--ink)" />
              </g>
            ))}
          </svg>
        )}
      </div>

      <p className="sr-only" role="status">
        {selected ? `Selected: ${selected.name}. ${relatedIds.length} related concepts. Details are below the map.` : ""}
      </p>

      {selected && (
        <aside
          aria-label="Selected concept"
          className="sticky bottom-3 z-20 mt-5 max-h-[50vh] overflow-y-auto rounded-[3px] border border-ink bg-surface p-4"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h3 ref={headingRef} tabIndex={-1} className="text-[1.3rem] outline-offset-4">
              {selected.name}
            </h3>
            <div className="flex flex-wrap gap-2">
              <Badge tone={selected.kind === "modelled" ? "ink" : undefined}>
                {selected.kind === "explained" ? "◇ " : ""}
                {KIND_TEXT[selected.kind]}
              </Badge>
              <Badge>{ERA_TEXT[selected.era]}</Badge>
              {selected.modules.map((m) => (
                <Badge key={m}>{GROUP_BY_ID.get(m) ? groupLabel(GROUP_BY_ID.get(m)!) : m}</Badge>
              ))}
            </div>
            <button type="button" onClick={closePanel} className="ui ml-auto shrink-0 rounded-[3px] border border-rule px-3 py-1 text-[0.88rem] hover:border-ink hover:bg-paper">
              Close<span className="sr-only"> details</span>
            </button>
          </div>
          {hiddenByFilter && (
            <p className="ui mt-2 text-[0.88rem] text-warn">
              This concept is hidden by the current filters, so it is not on the map.
            </p>
          )}
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,66ch)_minmax(0,1fr)] lg:gap-8">
            <div className="space-y-2">
              <p className="text-[1.02rem] leading-snug">{selected.definition}</p>
              <p className="text-[0.98rem] leading-snug text-ink-soft">
                <span className="ui font-semibold text-ink">In this project: </span>
                {selected.example}
              </p>
            </div>
            <div>
              <h4 className="ui text-[0.95rem]">Related concepts</h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {relatedIds.map((rid) => {
                  const r = CONCEPT_BY_ID.get(rid);
                  if (!r) return null;
                  return (
                    <li key={rid}>
                      <button
                        type="button"
                        onClick={() => {
                          refocusPanel.current = true;
                          onSelect(rid);
                        }}
                        className="ui min-h-9 rounded-[3px] border border-rule bg-paper px-3 py-1 text-[0.88rem] hover:border-ink hover:bg-ai-soft"
                      >
                        {r.short ?? r.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="ui mt-4 text-[0.95rem]">
                Appears on the{" "}
                <Link href={selected.page} className="font-semibold">
                  {pageLabel(selected.page)}
                </Link>
                .
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ list view */

function ListView({ lanes, selectedId, visibleIds }: { lanes: Lane[]; selectedId: string | null; visibleIds: ReadonlySet<string> }) {
  // A link such as /concepts#jevons should land on that concept. The browser's own scroll can run before the page is ready.
  useEffect(() => {
    if (selectedId) document.getElementById(selectedId)?.scrollIntoView({ block: "start" });
  }, [selectedId]);

  return (
    <div className="space-y-12">
      {lanes
        .filter((l) => l.items.length > 0)
        .map(({ group, items }) => {
          const tone = TONE[group.id];
          const headId = `list-${group.id}`;
          const mod = MODULES.find((m) => m.id === group.id);
          return (
            <section key={group.id} aria-labelledby={headId}>
              <div className="border-b-[3px] pb-2" style={{ borderColor: tone.line }}>
                <h2 id={headId} className="text-[1.5rem]">
                  <span style={{ color: tone.deep }}>{group.id === "Foundations" || group.id === "India" ? "" : `${group.id} `}</span>
                  {group.id === "Foundations" ? "Foundations" : group.id === "India" ? "India" : group.name}
                </h2>
                <p className="ui mt-1 max-w-[70ch] text-[0.95rem] text-ink-soft">
                  {group.question}
                  {mod && (
                    <>
                      {" "}
                      <Link href={mod.route}>Go to the {mod.id === "India" ? "India" : mod.id} page</Link>.
                    </>
                  )}
                </p>
              </div>
              <ul className="mt-5 grid gap-4 lg:grid-cols-2">
                {items.map((c) => {
                  const isSel = c.id === selectedId;
                  const related = RELATED_BY_ID.get(c.id) ?? [];
                  return (
                    <li
                      key={c.id}
                      id={c.id}
                      className={`scroll-mt-24 rounded-[6px] border bg-surface p-4 sm:p-5 ${isSel ? "border-ink ring-2 ring-ink/25" : "border-rule"}`}
                    >
                      <h3 className="text-[1.2rem]">{c.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={c.kind === "modelled" ? "ink" : undefined}>
                          {c.kind === "explained" ? "◇ " : ""}
                          {KIND_TEXT[c.kind]}
                        </Badge>
                        <Badge>{ERA_TEXT[c.era]}</Badge>
                        {c.modules.length > 1 && <Badge>Also used in {c.modules.slice(1).join(", ")}</Badge>}
                      </div>
                      <p className="mt-3 max-w-[62ch] text-[1.02rem] leading-snug">{c.definition}</p>
                      <p className="mt-2 max-w-[62ch] text-[0.98rem] leading-snug text-ink-soft">
                        <span className="ui font-semibold text-ink">In this project: </span>
                        {c.example}
                      </p>
                      <p className="ui mt-3 text-[0.92rem]">
                        Appears on the <Link href={c.page}>{pageLabel(c.page)}</Link>.
                      </p>
                      {related.length > 0 && (
                        <p className="ui mt-1 max-w-[62ch] text-[0.92rem] text-ink-soft">
                          Related:{" "}
                          {related.map((rid, i) => {
                            const r = CONCEPT_BY_ID.get(rid);
                            if (!r) return null;
                            return (
                              <span key={rid}>
                                {i > 0 && ", "}
                                {visibleIds.has(rid) ? <a href={`#${rid}`}>{r.short ?? r.name}</a> : <span>{r.short ?? r.name}</span>}
                              </span>
                            );
                          })}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
    </div>
  );
}

/* ------------------------------------------------------------------ the page body */

export function ConceptMap() {
  const [query, setQuery] = useState("");
  const [modules, setModules] = useState<GroupId[]>([]);
  const [era, setEra] = useState<"all" | Era>("all");
  const [kind, setKind] = useState<"all" | Kind>("all");
  const [view, setView] = useState<"map" | "list">("map");
  const narrow = useNarrow();
  const hash = useSyncExternalStore(subscribeHash, getHash, () => "");
  const selectedId = CONCEPT_BY_ID.has(hash) ? hash : null;

  const words = useMemo(() => query.trim().toLowerCase().split(/\s+/).filter(Boolean), [query]);
  const visible = useMemo(
    () =>
      CONCEPTS.filter((c) => {
        if (modules.length > 0 && !c.modules.some((m) => modules.includes(m))) return false;
        if (era !== "all" && c.era !== era) return false;
        if (kind !== "all" && c.kind !== kind) return false;
        if (words.length > 0) {
          const h = HAYSTACK.get(c.id) ?? "";
          if (!words.every((w) => h.includes(w))) return false;
        }
        return true;
      }),
    [modules, era, kind, words],
  );
  const visibleIds = useMemo(() => new Set(visible.map((c) => c.id)), [visible]);

  const lanes: Lane[] = useMemo(
    () =>
      GROUPS.filter((g) => CONCEPTS.some((c) => c.modules[0] === g.id)).map((g) => ({
        group: g,
        items: visible.filter((c) => c.modules[0] === g.id),
      })),
    [visible],
  );

  const filtered = query.trim() !== "" || modules.length > 0 || era !== "all" || kind !== "all";
  const clearFilters = () => {
    setQuery("");
    setModules([]);
    setEra("all");
    setKind("all");
  };
  const toggleModule = (g: GroupId) => setModules((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const onSelect = useCallback((id: string) => setHash(id), []);
  const onClear = useCallback(() => setHash(null), []);
  const effectiveView = narrow ? "list" : view;

  return (
    <div>
      <div className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-[14rem] flex-1">
            <label htmlFor="concept-search" className="ui block text-[0.95rem] font-semibold">
              Search concepts
            </label>
            <input
              id="concept-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="For example: wage, Jevons, monopoly"
              autoComplete="off"
              className="ui mt-1 w-full rounded-[6px] border border-rule bg-paper px-3 py-2 text-[1rem] placeholder:text-ink-faint"
            />
          </div>
          {!narrow && (
            <div role="group" aria-label="View" className="ui inline-flex rounded-[3px] border border-rule bg-paper p-0.5 text-[0.92rem]">
              {(["map", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-[2px] px-4 py-1.5 transition-colors ${view === v ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"}`}
                >
                  {v === "map" ? "Map view" : "List view"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <FilterRow label="Module">
            {GROUPS.map((g) => (
              <Chip key={g.id} pressed={modules.includes(g.id)} onClick={() => toggleModule(g.id)}>
                {groupLabel(g)}
              </Chip>
            ))}
          </FilterRow>
          <FilterRow label="Era">
            <Chip pressed={era === "all"} onClick={() => setEra("all")}>
              Both
            </Chip>
            <Chip pressed={era === "classic"} onClick={() => setEra("classic")}>
              Classic
            </Chip>
            <Chip pressed={era === "modern"} onClick={() => setEra("modern")}>
              Modern
            </Chip>
          </FilterRow>
          <FilterRow label="Modelled or explained">
            <Chip pressed={kind === "all"} onClick={() => setKind("all")}>
              Both
            </Chip>
            <Chip pressed={kind === "modelled"} onClick={() => setKind("modelled")}>
              Modelled
            </Chip>
            <Chip pressed={kind === "explained"} onClick={() => setKind("explained")}>
              Explained only
            </Chip>
          </FilterRow>
        </div>

        <div className="ui mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.92rem] text-ink-soft">
          <p role="status" aria-live="polite" className="max-w-none">
            Showing {visible.length} of {CONCEPTS.length} concepts.
          </p>
          {filtered && (
            <button type="button" onClick={clearFilters} className="underline">
              Clear search and filters
            </button>
          )}
        </div>
      </div>

      <p className="ui mt-4 max-w-[80ch] text-[0.92rem] text-ink-soft">
        {effectiveView === "map"
          ? "Choose a concept to see lines to the concepts it connects with and a short explanation. Arrow keys move between concepts and Escape closes the details. A diamond marks a concept that is explained but not modelled."
          : "Every concept, grouped by the module where it first appears. A diamond marks a concept that is explained but not modelled."}
      </p>

      <div className="mt-4">
        {visible.length === 0 ? (
          <p className="ui panel px-4 py-6 text-[1rem]">
            No concepts match. {filtered && (
              <button type="button" onClick={clearFilters} className="underline">
                Clear search and filters
              </button>
            )}
          </p>
        ) : effectiveView === "map" ? (
          <MapView lanes={lanes} selectedId={selectedId} visibleIds={visibleIds} onSelect={onSelect} onClear={onClear} />
        ) : (
          <ListView lanes={lanes} selectedId={selectedId} visibleIds={visibleIds} />
        )}
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <Caveat title="What modelled and explained mean">
          <p>
            Modelled means a module uses the idea in a model or estimates it from data. Explained only means the site describes the idea in plain English, with no sliders or
            estimates behind it.
          </p>
        </Caveat>
        <Caveat title="What classic and modern mean">
          <p>
            Classic means the main framework was set out before about 1970, such as Ricardo on trade or Keynes on demand. Modern means 1970 or later, including work on digital
            technology and AI. Many ideas have a long history, so the label follows the framework used here.
          </p>
        </Caveat>
      </div>
    </div>
  );
}
