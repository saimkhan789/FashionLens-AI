import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FashionLens AI",
  description: "AI-powered fashion search",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}