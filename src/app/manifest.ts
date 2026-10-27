import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "RUTINA · Seguimiento",
    short_name: "RUTINA",
    description: "Rutina y seguimiento de entrenamiento.",
    lang: "es",
    start_url: "/entrenar",
    scope: "/",
    display: "standalone",
    background_color: "#101510",
    theme_color: "#111611",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
