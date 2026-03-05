import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Syncore AI Dashboard",
  description: "AI-powered CRM automation for decorated apparel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
