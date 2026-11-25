import type { Metadata } from "next";
import { PageHead, Section } from "@/components/ui";
import { PresentationPlayer } from "@/components/PresentationPlayer";

export const metadata: Metadata = {
  title: "Video presentation | Why Pay Anyone?",
  description: "The whole project in six minutes: the wage ceiling, the price of AI, where it is used, adoption, the labour model, market power, macroeconomics and India, narrated with every chart drawn from the data.",
};

export default function PresentationPage() {
  return (
    <>
      <PageHead
        title="Video presentation"
        question="The question, the data, the models and what they mean, in six narrated minutes. Every chart moves with the sentence that describes it."
      />
      <Section className="pt-0 sm:pt-0">
        <PresentationPlayer />
      </Section>
    </>
  );
}
