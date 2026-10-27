import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Destino del enlace de confirmación del correo. Admite el flujo PKCE (?code=)
// y el de plantilla personalizada (?token_hash=&type=).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const supabase = await createSupabaseServerClient();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;

  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = ok ? "/entrenar" : "/login";
  if (!ok) url.searchParams.set("error", "confirmacion");
  return NextResponse.redirect(url);
}
