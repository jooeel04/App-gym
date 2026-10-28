import "server-only";
import { createClient } from "@supabase/supabase-js";

// Solo servidor: la clave secreta nunca llega al navegador (no lleva NEXT_PUBLIC_).
const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? "";

// Sin configuración la app funciona en modo local (datos en el navegador).
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseSecretKey);

export function createSupabaseAdminClient() {
  if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
