import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Acceder · FitGym" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // En modo local no hay cuentas.
  if (!isSupabaseConfigured) redirect("/entrenar");
  const { error } = await searchParams;
  return <LoginForm confirmationFailed={error === "confirmacion"} googleFailed={error === "google"} />;
}
