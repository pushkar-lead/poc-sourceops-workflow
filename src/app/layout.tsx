import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "1Source Ops — POC",
  description: "Mode-4 fulfilment ops panel — clickable POC with dummy data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
