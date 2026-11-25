export type SiteLink = { href: string; label: string; short: string; id?: string; n?: string; q: string };

export const SITE_LINKS: SiteLink[] = [
  { href: "/", label: "Home", short: "Home", q: "The question, the abstract and the live model" },
  { href: "/journey", label: "Guided reading", short: "Guided reading", q: "Seven chapters: guess first, then see the data" },
  { href: "/m1", label: "Prices", short: "Prices", id: "M1", n: "1", q: "How fast is the price of intelligence falling?" },
  { href: "/m2", label: "Usage", short: "Usage", id: "M2", n: "2", q: "Which jobs does AI touch?" },
  { href: "/m3", label: "Adoption", short: "Adoption", id: "M3", n: "3", q: "Are firms using it, and is it in hiring?" },
  { href: "/m4", label: "Wages", short: "Wages", id: "M4", n: "4", q: "What happens to pay when AI can do the task?" },
  { href: "/m5", label: "Markets", short: "Markets", id: "M5", n: "5", q: "Who sells the intelligence?" },
  { href: "/m6", label: "Growth and policy", short: "Policy", id: "M6", n: "6", q: "Growth, inequality, taxes and basic income" },
  { href: "/india", label: "India", short: "India", n: "7", q: "How Indian workers use AI, and how exposed they are" },
  { href: "/concepts", label: "Concepts", short: "Concepts", q: "61 economics ideas, in plain words" },
  { href: "/data", label: "Data and method", short: "Data", q: "Every source and its limits" },
  { href: "/presentation", label: "Video presentation", short: "Video", q: "The whole project in six narrated minutes" },
  { href: "/report", label: "Report", short: "Report", q: "The five-page written report, as a PDF" },
];

export const CITE = "Why Pay Anyone? The Economics of Cheap Intelligence. Lab Based Project, BS-MS Economics, IIT Roorkee (industry track, Hello Agentic), November 2026.";
