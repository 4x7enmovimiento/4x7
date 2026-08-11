import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://familia-cuatro-por-siete.p-glez-lpz92.chatgpt.site"),
  title: "4x7 — Tu familia en movimiento",
  description: "La red privada que convierte el ejercicio familiar en un hábito compartido.",
  openGraph: {
    title: "4×7 — Tu familia en movimiento",
    description: "Constancia, competencia sana y motivación familiar: cuatro días de siete.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "4×7, tu familia en movimiento" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "4×7 — Tu familia en movimiento",
    description: "Constancia, competencia sana y motivación familiar.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
