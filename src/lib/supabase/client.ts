import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

// Cliente para el navegador. La sesión se comparte con el servidor mediante cookies.
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}
