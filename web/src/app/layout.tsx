import type { Metadata, Viewport } from "next";
import { Source_Serif_4, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ModulePager } from "@/components/ModulePager";
import { Chat } from "@/components/Chat";
import { ChatContextProvider } from "@/components/chat-context";
import { Splash } from "@/components/Splash";
import { HideOn } from "@/components/HideOn";
import capability from "@/data/m1_price_of_capability.json";

/** The splash draws the cheapest price of GPT-4-level AI (Epoch Capabilities Index 120 or more), month by month. */
const SPLASH_SERIES = (capability as { threshold: number; month: string; price: number; cheapest_model: string }[])
  .filter((r) => r.threshold === 120)
  .map((r) => ({ month: r.month, price: r.price, model: r.cheapest_model }));

const serif = Source_Serif_4({
  variable: "--ff-serif",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const sans = Source_Sans_3({
  variable: "--ff-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Why Pay Anyone? The economics of cheap intelligence",
  description:
    "If AI agents do the work for cents, why would anyone pay a person to do it? An interactive economics lab built on real data: prices, usage, jobs, markets and policy.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <noscript>
          <style>{"#splash{display:none}"}</style>
        </noscript>
      </head>
      <body className="min-h-screen">
        <Splash series={SPLASH_SERIES} />
        <ChatContextProvider>
          <Nav />
          <main>{children}</main>
          <ModulePager />
          <HideOn paths={["/journey"]}>
            <Footer />
          </HideOn>
          <Chat />
        </ChatContextProvider>
      </body>
    </html>
  );
}
