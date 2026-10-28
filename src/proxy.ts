import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Excluye estáticos, iconos, manifest, service worker y el envío de recordatorios
  // (lo llama Supabase con su secreto, sin sesión de usuario).
  matcher: ["/((?!api/reminders|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
