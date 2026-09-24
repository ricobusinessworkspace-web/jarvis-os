import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BootSplash } from "@/components/layout/BootSplash";

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
        Die Startsequenz liegt bewusst **über** dem Inhalt, nicht davor:
        `children` steht zuerst im DOM und rendert serverseitig wie immer.

        Der EcosystemLoader, der hier früher stand, verschwand per useEffect —
        also erst nach vollständiger Hydration — und hat den Start dadurch
        künstlich verlängert. `BootSplash` enthält kein JavaScript, endet nach
        fester Zeit und lässt mit `pointer-events: none` jeden Klick durch.
        Wer hier wieder etwas mit useState/useEffect einbaut, baut den alten
        Fehler nach.
      */}
      <body className="min-h-full">
        {children}
        <BootSplash />
      </body>
    </html>
  );
}
