import type { Metadata } from "next";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Chat } from "@/components/Chat";
import { ChatContextProvider } from "@/components/chat-context";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Why Pay Anyone? The economics of cheap intelligence",
  description:
    "If AI agents do the work for cents, why would anyone pay a person to do it? An interactive economics lab built on real data: prices, usage, jobs, markets and policy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${bricolage.variable} ${newsreader.variable}`}>
      <body className="min-h-screen">
        <ChatContextProvider>
          <Nav />
          <main>{children}</main>
          <footer className="mt-24 border-t border-rule">
            <div className="mx-auto max-w-[1180px] px-5 py-10 text-[0.95rem] text-ink-soft">
              <p className="max-w-[80ch]">
                A Lab Based Project in economics at IIT Roorkee, built under the industry track at Hello Agentic. Every number on this site
                comes from a public dataset listed on the <a href="/data">data page</a>. Results are scenarios and exploratory estimates, not
                forecasts. Code and data tables are in the{" "}
                <a href="https://github.com/amsorrytola/why-pay-anyone">public repository</a>.
              </p>
            </div>
          </footer>
          <Chat />
        </ChatContextProvider>
      </body>
    </html>
  );
}
