// Configuración pública de Supabase. Next sustituye las NEXT_PUBLIC_* en tiempo de build.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// Sin configuración la app funciona en modo local, sin cuenta.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
