// Copyright © 2026 OrbitSys. Tous droits réservés.

import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "OrbitAll - L'assistant intelligent pour les entreprises",
  description: "Créé par AlphaSys-AI - Propulsé par OpenAI",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

// Mobile-first : largeur = écran réel, zoom utilisateur conservé (accessibilité).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
