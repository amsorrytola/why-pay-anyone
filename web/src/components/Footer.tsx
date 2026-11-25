import Link from "next/link";
import { LogoMark, SITE_LINKS } from "@/components/site";

export function Footer() {
  const labs = SITE_LINKS.filter((l) => l.id);
  const more = SITE_LINKS.filter((l) => !l.id);
  return (
    <footer className="night on-night mt-16">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark size={36} />
            <span className="serif text-[1.5rem] leading-none text-on-night">Why Pay Anyone?</span>
          </div>
          <p className="ui mt-4 max-w-[46ch] text-[0.95rem] leading-relaxed text-on-night-soft">
            An interactive economics lab on cheap intelligence. A Lab Based Project at IIT Roorkee, built under the industry track at Hello Agentic.
          </p>
          <p className="ui mt-3 max-w-[46ch] text-[0.85rem] leading-relaxed text-on-night-soft/80 [&_a]:text-ai-glow">
            Every number comes from a public dataset listed on the <Link href="/data">data page</Link>. Results are scenarios and exploratory estimates, not forecasts.
          </p>
        </div>
        <nav aria-label="Labs">
          <h3 className="ui mb-3 text-[0.9rem] font-semibold text-on-night">The labs</h3>
          <ul className="space-y-2">
            {labs.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="ui text-[0.95rem] text-on-night-soft no-underline hover:text-white">
                  <span className="mono mr-2 text-[0.8rem] text-ai-glow">{l.id}</span>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="More">
          <h3 className="ui mb-3 text-[0.9rem] font-semibold text-on-night">The project</h3>
          <ul className="space-y-2">
            {more.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="ui text-[0.95rem] text-on-night-soft no-underline hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a href="https://github.com/amsorrytola/why-pay-anyone" className="ui text-[0.95rem] text-on-night-soft no-underline hover:text-white">
                Code and data tables
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
