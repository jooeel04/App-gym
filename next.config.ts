import type { NextConfig } from "next";
import pkg from "./package.json";

// Versión que se ve en Ajustes: la del package.json y el commit desplegado en Vercel.
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version + (commit ? " · " + commit : ""),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
  },
  // En `npm run dev`, permite abrir la app desde el móvil por la wifi de casa.
  allowedDevOrigins: ["192.168.*.*"],
  async headers() {
    return [
      {
        // El service worker no debe quedarse en caché para que las actualizaciones lleguen.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
