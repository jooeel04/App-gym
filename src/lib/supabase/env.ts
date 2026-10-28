// Configuración de Supabase. Se aceptan los nombres sin y con NEXT_PUBLIC_ (los que
// ya están configurados en Vercel): la clave es la pública (publishable/anon), así
// que no pasa nada si llega al navegador; la protección de los datos son las
// políticas RLS. El navegador habla con Supabase solo a través del servidor.
export const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

// Sin configuración la app funciona en modo local, sin cuentas.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
