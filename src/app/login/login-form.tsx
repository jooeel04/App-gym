"use client";

import { useActionState } from "react";
import { BrandIcon } from "@/components/icons";
import { authenticate, type AuthFormState } from "./actions";

export function LoginForm({ confirmationFailed }: { confirmationFailed: boolean }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    authenticate,
    confirmationFailed ? { error: "El enlace de confirmación no es válido o ha caducado." } : {},
  );

  return (
    <div className="auth-page">
      <div className="modal">
        <div className="brand auth-brand">
          <span className="brand-icon"><BrandIcon /></span>
          <span><span className="brand-word">RUTINA</span><span className="brand-sub">SEGUIMIENTO</span></span>
        </div>
        <h2>Accede a tu cuenta</h2>
        <p>Tus registros se guardan en tu cuenta y se sincronizan entre dispositivos.</p>
        <form action={action}>
          <label className="form-label">Correo electrónico<input name="email" type="email" autoComplete="email" required disabled={pending} /></label>
          <label className="form-label">Contraseña<input name="password" type="password" autoComplete="current-password" minLength={6} required disabled={pending} /></label>
          {state.error && <p className="auth-msg error" role="alert">{state.error}</p>}
          {state.message && <p className="auth-msg" role="status">{state.message}</p>}
          <div className="modal-actions">
            <button type="submit" name="intent" value="signup" disabled={pending}>Crear cuenta</button>
            <button className="primary" type="submit" name="intent" value="signin" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
