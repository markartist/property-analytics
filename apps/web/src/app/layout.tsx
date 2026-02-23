import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "POP Brief — Venterra WebOps",
  description: "Property Ops Performance Brief by Venterra WebOps",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
