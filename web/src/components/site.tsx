export const SITE_LINKS = [
  { href: "/", label: "The question", short: "The question", q: "The whole idea on one chart" },
  { href: "/m1", label: "Prices", short: "Prices", id: "M1", q: "How fast is the price of intelligence falling?" },
  { href: "/m2", label: "Usage", short: "Usage", id: "M2", q: "Which jobs does AI touch?" },
  { href: "/m3", label: "Adoption", short: "Adoption", id: "M3", q: "Are firms using it, and is it in hiring?" },
  { href: "/m4", label: "Wages", short: "Wages", id: "M4", q: "What happens to pay when AI can do the task?" },
  { href: "/m5", label: "Markets", short: "Markets", id: "M5", q: "Who sells the intelligence?" },
  { href: "/m6", label: "Growth and policy", short: "Policy", id: "M6", q: "Growth, inequality, taxes and basic income" },
  { href: "/india", label: "India", short: "India", q: "Use and exposure of Indian workers" },
  { href: "/concepts", label: "Concepts", short: "Concepts", q: "61 economics ideas, in plain words" },
  { href: "/data", label: "Data and method", short: "Data", q: "Every source and its limits" },
];

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="lm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d38c7" />
          <stop offset="1" stopColor="#3357ff" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#lm)" />
      <path d="M7 12h8v6h8v6h8" fill="none" stroke="#f6a812" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="31" cy="24" r="3.3" fill="#fff" />
    </svg>
  );
}
