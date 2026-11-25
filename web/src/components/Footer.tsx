import Link from "next/link";
import { CITE, SITE_LINKS } from "@/components/site";

export function Footer() {
  const chapters = SITE_LINKS.filter((l) => l.n);
  const more = SITE_LINKS.filter((l) => !l.n && l.href !== "/");
  return (
    <footer className="mt-20">
      <div className="mx-auto max-w-[1180px] px-5 pb-14 sm:px-8">
        <div className="rule-double grid gap-10 pt-8 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <p className="serif text-[1.35rem] font-semibold leading-tight">Why Pay Anyone?</p>
            <p className="ui mt-3 max-w-[46ch] text-[0.92rem] leading-relaxed text-ink-soft">
              An interactive economics study of cheap intelligence. A Lab Based Project at IIT Roorkee, built under the industry track at Hello Agentic. Every number comes from a public dataset listed on the{" "}
              <Link href="/data">data page</Link>. Results are scenarios and exploratory estimates, not forecasts.
            </p>
            <p className="ui mt-4 max-w-[52ch] border-t border-rule pt-3 text-[0.82rem] leading-relaxed text-ink-soft">
              <b className="text-ink">Cite as:</b> {CITE}
            </p>
          </div>
          <nav aria-label="Chapters in the footer">
            <h2 className="ui text-[0.9rem] font-bold">Chapters</h2>
            <ul className="mt-2">
              {chapters.map((l) => (
                <li key={l.href} className="border-b border-rule">
                  <Link href={l.href} className="entry ui flex gap-3 py-1.5 text-[0.92rem]">
                    <span className="w-4 text-ink-faint">{l.n}</span>
                    <span className="entry-title">{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Reference">
            <h2 className="ui text-[0.9rem] font-bold">Reference</h2>
            <ul className="mt-2">
              {more.map((l) => (
                <li key={l.href} className="border-b border-rule">
                  <Link href={l.href} className="entry ui block py-1.5 text-[0.92rem]">
                    <span className="entry-title">{l.label}</span>
                  </Link>
                </li>
              ))}
              <li className="border-b border-rule">
                <a href="https://github.com/amsorrytola/why-pay-anyone" className="entry ui block py-1.5 text-[0.92rem]">
                  <span className="entry-title">Code and data tables (GitHub)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
