import type { Metadata } from "next";
import Journey from "@/components/Journey";

export const metadata: Metadata = {
  title: "Guided journey | Why Pay Anyone?",
  description: "Seven short chapters on AI and the economy. Guess first, then see what the data says.",
};

export default function JourneyPage() {
  return <Journey />;
}
