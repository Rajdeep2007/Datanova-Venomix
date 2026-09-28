import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/ThemeContext";
import { SessionProvider } from "@/lib/SessionContext";

export const metadata: Metadata = {
  title: "Data Nova AI — AI-Powered Data Diagnostics",
  description: "AI-powered data diagnostics and remediation.",
  icons: {
    icon: "/favicon.ico",
  },
  authors: [{ name: "Data Nova AI" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        <ThemeProvider>
          <SessionProvider>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
