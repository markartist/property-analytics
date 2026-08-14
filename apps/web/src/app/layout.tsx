import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-lato",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Data Pond — WebOps",
  description: "Analytics resort for property data — reports, monitoring, and AI-powered insights.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "96x96" }],
    apple: [{ url: "/favicon.png", type: "image/png", sizes: "96x96" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${lato.variable} min-h-screen bg-slate-50 antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
