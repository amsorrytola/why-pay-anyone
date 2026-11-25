import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ModulePager } from "@/components/ModulePager";
import { Chat } from "@/components/Chat";
import { ChatContextProvider } from "@/components/chat-context";
import { Splash } from "@/components/Splash";
import { HideOn } from "@/components/HideOn";
import fits from "@/data/m1_price_decline_fits.json";

const F120 = (fits as { threshold: number; price_first: number; price_last: number }[]).find((f) => f.threshold === 120)!;
const SPLASH_SEEN = "try{if(sessionStorage.getItem('wpa-splash'))document.documentElement.dataset.splash='seen'}catch(e){}";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Why Pay Anyone? The economics of cheap intelligence",
  description:
    "If AI agents do the work for cents, why would anyone pay a person to do it? An interactive economics lab built on real data: prices, usage, jobs, markets and policy.",
};

export const viewport: Viewport = {
  themeColor: "#070e2c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SEEN }} />
        <noscript>
          <style>{"#splash{display:none}"}</style>
        </noscript>
      </head>
      <body className="min-h-screen">
        <Splash from={F120.price_first} to={F120.price_last} />
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
