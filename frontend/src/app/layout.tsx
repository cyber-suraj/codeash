import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODEASH | Local Security Audit",
  description:
    "Private, local security audit before you launch. Deterministic AST scanning, Gemma 2 patch synthesis, and Python proof before any fix is trusted.",
  keywords: [
    "CodeAsh",
    "security",
    "AST",
    "Gemma 2",
    "Ollama",
    "local-first",
    "CWE-78",
    "CWE-502",
    "CWE-798",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] antialiased">{children}</body>
    </html>
  );
}
