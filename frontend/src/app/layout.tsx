import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import SignInPrompt from "@/components/SignInPrompt";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FashionLens: find the outfit, buy it from Pakistani brands",
  description: "Upload an outfit photo or describe it. FashionLens finds each piece and shows products you can buy from Pakistani brands.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jakarta.variable}`}>
      <body>
        <SessionProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-[13px] text-muted sm:px-8">
              <p>
                <span className="font-display text-lg font-semibold text-ink">
                  fashionlens<span className="text-accent">.</span>
                </span>{" "}
                Every product links to the brand&apos;s own shop.
              </p>
              <div className="flex gap-5">
                <Link href="/search" className="hover:text-ink">Search</Link>
                <Link href="/saved" className="hover:text-ink">Saved</Link>
                <Link href="/history" className="hover:text-ink">History</Link>
              </div>
            </div>
          </footer>
          <SignInPrompt />
        </SessionProvider>
      </body>
    </html>
  );
}
