import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Vuelta desde Google, al entrar o al conectarlo desde Ajustes (?next=/ajustes). Abre la
// sesión con el código; si se canceló o falló, vuelve con un aviso propio de Google.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const fromSettings = next === "/ajustes";

  let ok = false;
  if (code && !searchParams.get("error")) {
    const supabase = await createSupabaseServerClient();
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  const url = request.nextUrl.clone();
  url.search = "";
  if (fromSettings) {
    // Ajustes lee el resultado una vez (y limpia la dirección).
    url.pathname = "/ajustes";
    url.searchParams.set("google", ok ? "conectado" : searchParams.get("error_code") === "identity_already_exists" ? "ocupado" : "error");
  } else if (ok) {
    url.pathname = "/entrenar";
  } else {
    url.pathname = "/login";
    url.searchParams.set("error", "google");
  }
  return NextResponse.redirect(url);
}
