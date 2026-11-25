import type { Metadata } from "next";
import Link from "next/link";
import { PageHead, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Report | Why Pay Anyone?",
  description: "The five-page written report of the project: question and objectives, data, methods and results for all seven chapters, economic interpretation, limitations and references.",
};

const PDF = "/report/why-pay-anyone-report.pdf";

const CONTENTS = [
  ["1", "Question and objectives", "The wage ceiling, the four forces that decide pay, and why each method was chosen"],
  ["2", "Data", "Ten sources, from Epoch AI and LiteLLM prices to the PLFS 2025 microdata"],
  ["3", "Methods and results", "Price, use, adoption, the labour model, market power, macroeconomics and India, with five figures"],
  ["4", "Economic interpretation", "The economic concepts applied, and what the results mean for pay, distribution, competition and India"],
  ["5", "Limitations", "What the data and models cannot tell you"],
  ["6", "What was built", "The pipeline, the website, the video, and the AI tools used"],
];

export default function ReportPage() {
  return (
    <>
      <PageHead
        title="Report"
        question="The written report: five A4 pages with the question, data, methods, results for all seven chapters, the economic interpretation and the references."
      >
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a href={PDF} className="btn btn-ink">
            Open the report (PDF, 5 pages)
          </a>
          <a href={PDF} download="LBP_Report_23322016_Why_Pay_Anyone.pdf" className="btn btn-ghost">
            Download the PDF
          </a>
          <Link href="/presentation" className="btn btn-ghost">
            Watch the video instead
          </Link>
        </div>
      </PageHead>

      <Section className="pt-0 sm:pt-0">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-14">
          <div>
            <h2 className="text-[1.5rem]">Contents</h2>
            <ol className="mt-3 border-t border-ink">
              {CONTENTS.map(([n, t, d]) => (
                <li key={n} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-b border-rule py-3">
                  <span className="serif text-[1.2rem] font-semibold text-ai">{n}</span>
                  <span>
                    <span className="serif block text-[1.15rem] font-semibold leading-snug">{t}</span>
                    <span className="ui block text-[0.9rem] leading-snug text-ink-soft">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="ui mt-4 text-[0.86rem] text-ink-faint">
              Talha Ansari, enrolment number 23322016. Lab Based Project (HSC-400), BS-MS Economics, IIT Roorkee; industry track with Hello Agentic. November 2026.
            </p>
          </div>
          <figure className="m-0 hidden lg:block">
            <figcaption className="ui mb-3 text-[1.02rem] font-semibold">The report</figcaption>
            <object data={`${PDF}#view=FitH`} type="application/pdf" className="block h-[78vh] min-h-[560px] w-full border border-ink" aria-label="The report, as a PDF">
              <p className="p-4">
                Your browser cannot show the PDF here. <a href={PDF}>Open the report</a>.
              </p>
            </object>
          </figure>
        </div>
      </Section>
    </>
  );
}
