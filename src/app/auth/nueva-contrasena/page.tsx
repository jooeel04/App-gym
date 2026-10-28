import { redirect } from "next/navigation";
import { connection } from "next/server";
import { updatePassword } from "@/app/login/actions";
import { NewPasswordForm } from "@/app/login/login-form";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata = { title: "Contraseña nueva · RUTINA" };

// Se llega desde el enlace del correo de recuperación, que ya inicia la sesión.
export default async function NewPasswordPage() {
  // Depende de la sesión de cada visita: nunca se genera de antemano.
  await connection();
  if (!(await getCurrentUser())) redirect("/login?error=confirmacion");
  return <NewPasswordForm action={updatePassword} />;
}
