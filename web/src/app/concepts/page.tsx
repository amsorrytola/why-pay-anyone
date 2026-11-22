import type { Metadata } from "next";
import { PageHead, Section } from "@/components/ui";
import { ConceptMap } from "@/components/concept-map";
import { CONCEPTS } from "@/content/concepts";

export const metadata: Metadata = {
  title: "Concept map | Why Pay Anyone?",
  description: "The economics concepts behind the site, grouped by module, with a plain-English definition and an example from the project's data for each.",
};

export default function ConceptsPage() {
  const modelled = CONCEPTS.filter((c) => c.kind === "modelled").length;
  return (
    <>
      <PageHead
        title="Concept map"
        question={`${CONCEPTS.length} ideas from economics that the site uses, placed by the module where each first appears. Pick one to see what it means, how it is used here and which ideas it connects to.`}
      >
        <p className="ui mt-3 max-w-[62ch] text-[0.95rem] text-ink-soft">
          {modelled} are modelled or estimated with data; {CONCEPTS.length - modelled} are explained in plain English only. Terms with a dotted underline on the other pages open a short
          definition and link back here.
        </p>
      </PageHead>
      <Section>
        <ConceptMap />
      </Section>
    </>
  );
}
