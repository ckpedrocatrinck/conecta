import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { BRAND_TOKENS } from "@/lib/cards/brand-tokens";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ClientErrorReporter } from "@/components/debug/client-error-reporter";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Conecta",
  description: "Plataforma de comunicação interna",
};

// viewportFit "cover" habilita env(safe-area-inset-*) no iOS — exigido pela
// bottom nav fixa (INC-008.5 / ADR-002 mobile-first). themeColor pinta a
// barra de status/chrome do navegador com a cor de marca (INC-012).
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: BRAND_TOKENS.primary,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <ClientErrorReporter />
        {children}
      </body>
    </html>
  );
}
