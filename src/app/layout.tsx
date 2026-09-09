import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jarvis OS",
  description: "Personal Operating System — Command Center for Projects, Knowledge & Productivity",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jarvis OS",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${inter.variable} h-full antialiased dark`}>
      {/*
        Kein Lade-Overlay mehr: der EcosystemLoader legte einen schwarzen
        Vollbild-Layer über die App und nahm ihn erst per useEffect weg — also
        erst nach vollständiger Hydration. Der Inhalt ist serverseitig längst
        gerendert; das Overlay hat ihn nur versteckt und den Start künstlich
        verlängert.
      */}
      <body className="min-h-full">{children}</body>
    </html>
  );
}
