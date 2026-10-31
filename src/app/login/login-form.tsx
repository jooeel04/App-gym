"use client";

import Image from "next/image";
import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "@/app/actions/account";
import { EyeIcon, EyeOffIcon, GoogleIcon } from "@/components/icons";
import { authenticate, requestPasswordReset, type AuthFormState } from "./actions";

function Brand() {
  return (
    <div className="brand auth-brand">
      <Image className="brand-icon brand-logo" src="/fitgym-azul-mark.png" width={96} height={96} alt="" priority />
      <span><span className="brand-word">FITGYM</span><span className="brand-sub">TU ENTRENO</span></span>
    </div>
  );
}

// Contraseña con un botón (ojo) para verla mientras se escribe: así se puede comprobar en
// el móvil sin tener que adivinar qué se ha tecleado.
function PasswordField({ label, name, autoComplete, disabled }: { label: string; name: string; autoComplete: string; disabled: boolean }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <div className="form-label">
      <label htmlFor={id}>{label}</label>
      <div className="pw-field">
        <input id={id} name={name} type={shown ? "text" : "password"} autoComplete={autoComplete} minLength={6} required disabled={disabled} />
        <button type="button" className="pw-toggle" aria-label="Mostrar contraseña" aria-pressed={shown} onClick={() => setShown(!shown)}>
          {shown ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
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

// Botón de Google: mientras se abre, no se puede pulsar otra vez.
function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="google-btn" disabled={pending}>
      <GoogleIcon />{pending ? "Abriendo Google…" : "Continuar con Google"}
    </button>
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

export function LoginForm({ confirmationFailed, googleFailed = false }: { confirmationFailed: boolean; googleFailed?: boolean }) {
  const [forgot, setForgot] = useState(false);
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    authenticate,
    googleFailed ? { error: "No se pudo entrar con Google. Inténtalo de nuevo." }
      : confirmationFailed ? { error: "El enlace no es válido o ha caducado. Pide otro." } : {},
  );

  return (
    <div className="auth-page">
      <div className="modal">
        <Brand />
        {forgot ? <ForgotPassword onBack={() => setForgot(false)} /> : (
          <>
            <h2>Accede a tu cuenta</h2>
            <p>Cada persona tiene su propia cuenta: tus registros se guardan solo en la tuya y se sincronizan entre tus dispositivos.</p>
            <form action={signInWithGoogle} className="google-form"><GoogleButton /></form>
            <p className="auth-or"><span>o con tu correo</span></p>
            <form action={action}>
              <label className="form-label">Correo electrónico<input name="email" type="email" autoComplete="email" required disabled={pending} /></label>
              <PasswordField label="Contraseña" name="password" autoComplete="current-password" disabled={pending} />
              <Messages state={state} />
              {/* «Entrar» va primero en el código: es el que usa el botón Ir del teclado. Se ve a la derecha. */}
              <div className="modal-actions auth-actions">
                <button className="primary" type="submit" name="intent" value="signin" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
                <button type="submit" name="intent" value="signup" disabled={pending}>Crear cuenta</button>
              </div>
            </form>
            <button type="button" className="auth-link" onClick={() => setForgot(true)}>¿Olvidaste tu contraseña?</button>
            <p className="auth-note">¿Ya tienes cuenta con otro correo? Entra con él y conecta Google desde Ajustes. Si es el mismo correo, Google entra en tu cuenta de siempre.</p>
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
          <PasswordField label="Contraseña nueva" name="password" autoComplete="new-password" disabled={pending} />
          <PasswordField label="Repite la contraseña" name="confirm" autoComplete="new-password" disabled={pending} />
          <Messages state={state} />
          <div className="modal-actions">
            <button className="primary" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contraseña"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
