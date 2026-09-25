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
        Kein useState/useEffect in der Startsequenz. Der EcosystemLoader, der
        hier früher stand, verschwand per useEffect — also erst nach
        vollständiger Hydration — und hat den Start dadurch künstlich
        verlängert. Wer hier wieder einen Zustand einbaut, baut den alten
        Fehler nach.
      */}
      <body className="min-h-full">
        {/*
          Beendet die Startsequenz am echten Ladeende statt nach Stoppuhr.
          Läuft während des HTML-Parsens, registriert nur Rückrufe und blockiert
          deshalb nichts.

          Ladeende ist `load`. Die Reiter streamen: der Server schickt sofort
          die Hülle und erst nach den Datenbankabfragen den Inhalt (auf dem
          Dashboard 2–4 s). `load` kommt erst, wenn der Strom zu ist — also
          wenn der Inhalt steht.

          Rückfalltüren, damit der Schleier nie hängen bleibt:
          - `SETTLE`: ist das Dokument durch (`DOMContentLoaded`, der Inhalt
            steht), aber ein Bild oder eine Schrift hält `load` auf, geht der
            Schleier trotzdem. Ein Fehler im Bundle hält `load` nicht auf.
          - `MAX`: der Server hängt mitten im Strom. Dann gibt es darunter auch
            nichts zu sehen außer dem Ladezustand des Reiters.
          Die frühere feste Obergrenze von 4 s lag mitten in der echten Ladezeit
          des Dashboards: der grosse Ball verschwand zu früh und der kleine aus
          `loading.tsx` stand an seiner Stelle.

          `MIN` ist so lang wie der Aufbau des Balls (Gitter, Knoten, Schrift-
          zug ≈ 1 s). Kürzer, und er ginge weg, bevor er fertig ist — dann wirkt
          er kleiner und halb gezeichnet.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){var MIN=1000,SETTLE=1500,MAX=15000,t0=Date.now(),d=0;' +
              'function go(){if(d)return;d=1;document.documentElement.dataset.booted="1";}' +
              'function ready(){setTimeout(go,Math.max(0,MIN-(Date.now()-t0)));}' +
              'setTimeout(go,MAX);' +
              'if(document.readyState==="complete"){ready();return;}' +
              'addEventListener("load",ready,{once:true});' +
              'addEventListener("DOMContentLoaded",function(){setTimeout(ready,SETTLE);},{once:true});})();',
          }}
        />
        {/*
          Vor dem Inhalt, nicht dahinter: der Browser darf ein halb
          empfangenes Dokument schon malen. Steht der Schleier zuerst im DOM,
          ist er in jedem ersten Bild dabei — dahinter könnte kurz das
          Dashboard aufblitzen. Oben liegt er über `z-index`, nicht über die
          Reihenfolge.
        */}
        <BootSplash />
        {children}
      </body>
    </html>
  );
}
