import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import { GlassSurfaces } from "@/components/glass-surfaces";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Letra estrecha de cifras iguales para los números del entreno (carga, repeticiones,
// descanso): se lee de un vistazo, como el marcador de un gimnasio. Next la sirve desde
// la propia app, así que también funciona sin internet.
const numbers = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-num", display: "swap" });

export const metadata: Metadata = {
  title: "FitGym",
  description: "Rutina y seguimiento de entrenamiento.",
  applicationName: "FitGym",
  appleWebApp: { capable: true, title: "FitGym", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/fitgym-azul-192.png", type: "image/png" }],
    apple: "/fitgym-azul-apple.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Sin zoom en el móvil: la app se usa como una aplicación nativa.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: el script del tema puede poner data-theme en <html> antes de hidratar.
    <html lang="es" className={numbers.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        {/* Cristal líquido en las tarjetas y botones de todas las pantallas. */}
        <GlassSurfaces />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
