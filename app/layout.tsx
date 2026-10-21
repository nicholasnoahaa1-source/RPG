import type { Metadata, Viewport } from "next";
import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const label = Chakra_Petch({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-label", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Stark Holographic Workstation",
  description: "Estação holográfica 3D para inspeção e manipulação de modelos GLB.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#02060a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${label.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
