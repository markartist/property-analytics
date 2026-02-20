import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "POP Brief",
  description: "Property Ops Performance Brief",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "1rem" }}>
        <header style={{ borderBottom: "1px solid #ccc", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
          <strong>POP Brief</strong>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
