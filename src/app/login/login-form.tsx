"use client";

import { useActionState, useState } from "react";
import { BrandIcon } from "@/components/icons";
import { authenticate, requestPasswordReset, type AuthFormState } from "./actions";

function Brand() {
  return (
    <div className="brand auth-brand">
      <span className="brand-icon"><BrandIcon /></span>
      <span><span className="brand-word">RUTINA</span><span className="brand-sub">SEGUIMIENTO</span></span>
    </div>
  );
}

function Messages({ state }: { state: AuthFormState }) {
  return (
    <>
      {state.error && <p className="auth-msg error" role="alert">{state.error}</p>}
      {state.message && <p className="auth-msg" role="status">{state.message}</p>}
    </>
  );
}

// Pide el correo y envía el enlace para crear una contraseña nueva.
function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(requestPasswordReset, {});
  return (
    <>
      <h2>Recuperar contraseña</h2>
      <p>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>
      <form action={action}>
        <label className="form-label">Correo electrónico<input name="email" type="email" autoComplete="email" required disabled={pending} /></label>
        <Messages state={state} />
        <div className="modal-actions">
          <button type="button" onClick={onBack} disabled={pending}>Volver</button>
          <button className="primary" type="submit" disabled={pending}>{pending ? "Enviando…" : "Enviar enlace"}</button>
        </div>
      </form>
    </>
  );
}

export function LoginForm({ confirmationFailed }: { confirmationFailed: boolean }) {
  const [forgot, setForgot] = useState(false);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    authenticate,
    confirmationFailed ? { error: "El enlace no es válido o ha caducado. Pide otro." } : {},
  );

  return (
    <div className="auth-page">
      <div className="modal">
        <Brand />
        {forgot ? <ForgotPassword onBack={() => setForgot(false)} /> : (
          <>
            <h2>Accede a tu cuenta</h2>
            <p>Cada persona tiene su propia cuenta: tus registros se guardan solo en la tuya y se sincronizan entre tus dispositivos.</p>
            <form action={action}>
              <label className="form-label">Correo electrónico<input name="email" type="email" autoComplete="email" required disabled={pending} /></label>
              <label className="form-label">Contraseña<input name="password" type="password" autoComplete="current-password" minLength={6} required disabled={pending} /></label>
              <Messages state={state} />
              <div className="modal-actions">
                <button type="submit" name="intent" value="signup" disabled={pending}>Crear cuenta</button>
                <button className="primary" type="submit" name="intent" value="signin" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
              </div>
            </form>
            <button type="button" className="auth-link" onClick={() => setForgot(true)}>¿Olvidaste tu contraseña?</button>
          </>
        )}
      </div>
    </div>
  );
}

// Formulario de contraseña nueva (tras abrir el enlace del correo).
export function NewPasswordForm({ action }: { action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState> }) {
  const [state, submit, pending] = useActionState<AuthFormState, FormData>(action, {});
  return (
    <div className="auth-page">
      <div className="modal">
        <Brand />
        <h2>Contraseña nueva</h2>
        <p>Escribe la contraseña que quieres usar a partir de ahora.</p>
        <form action={submit}>
          <label className="form-label">Contraseña nueva<input name="password" type="password" autoComplete="new-password" minLength={6} required disabled={pending} /></label>
          <label className="form-label">Repite la contraseña<input name="confirm" type="password" autoComplete="new-password" minLength={6} required disabled={pending} /></label>
          <Messages state={state} />
          <div className="modal-actions">
            <button className="primary" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
