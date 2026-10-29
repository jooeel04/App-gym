"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { changeEmail, changePassword, deleteAccount, getLiftPrivacy, saveLiftPrivacy } from "@/app/actions/account";
import { useWorkout } from "@/controllers/workout-controller";
import { APP_VERSION, BUILD_DATE, NOVEDADES } from "@/lib/novedades";
import { ALL_PLATES, BAR_OPTIONS, DEFAULT_PLATES, getPlatePrefs, setPlatePrefs, subscribePrefs } from "@/lib/preferences";
import { getTextSize, setTextSize, subscribeTheme, type TextSize } from "@/lib/theme";
import { DumbbellIcon, InfoIcon, LockIcon, MailIcon, ShieldIcon, TextSizeIcon, TrashIcon } from "./icons";
import { Row } from "./settings-rows";

type RowProps = { open: boolean; onToggle: () => void };
type Message = { ok: boolean; text: string } | null;

const fmt = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 2 });

function Feedback({ message }: { message: Message }) {
  if (!message) return null;
  return <p className={message.ok ? "perm-ok" : "perm-warn"} role={message.ok ? "status" : "alert"}>{message.text}</p>;
}

// ---- App ----

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "pequena", label: "Pequeña" },
  { value: "normal", label: "Normal" },
  { value: "grande", label: "Grande" },
  { value: "muy-grande", label: "Muy grande" },
];

export function TextSizeRow({ open, onToggle }: RowProps) {
  const size = useSyncExternalStore(subscribeTheme, getTextSize, () => "normal" as TextSize);
  return (
    <Row icon={<TextSizeIcon />} label="Tamaño de letra" value={TEXT_SIZES.find((t) => t.value === size)?.label} open={open} onClick={onToggle}>
      <p className="set-hint">Cambia el tamaño de todos los textos de la app.</p>
      <div className="text-sizes" role="radiogroup" aria-label="Tamaño de letra">
        {TEXT_SIZES.map((t) => (
          <button key={t.value} type="button" role="radio" aria-checked={size === t.value}
            className={"text-size " + t.value + (size === t.value ? " active" : "")} onClick={() => setTextSize(t.value)}>
            <span className="text-size-aa" aria-hidden="true">Aa</span>{t.label}
          </button>
        ))}
      </div>
    </Row>
  );
}

export function VersionRow({ open, onToggle }: RowProps) {
  return (
    <Row icon={<InfoIcon />} label="Versión y novedades" value={APP_VERSION.split(" ")[0]} open={open} onClick={onToggle}>
      <p className="set-hint">FitGym {APP_VERSION}{BUILD_DATE && " · actualizada el " + new Date(BUILD_DATE + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}</p>
      <div className="set-sub">Novedades</div>
      {NOVEDADES.map((n) => (
        <div key={n.date} className="news">
          <b>{n.date}</b>
          <ul>{n.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ))}
    </Row>
  );
}

// ---- Entreno ----

// La barra y los discos de tu gym: los usa la calculadora de discos.
export function PlatesRow({ open, onToggle }: RowProps) {
  const prefs = useSyncExternalStore(subscribePrefs, getPlatePrefs, () => DEFAULT_PLATES);
  const togglePlate = (p: number) => {
    const plates = prefs.plates.includes(p) ? prefs.plates.filter((x) => x !== p) : [...prefs.plates, p];
    if (plates.length) setPlatePrefs({ ...prefs, plates });
  };
  const missing = ALL_PLATES.length - prefs.plates.length;
  return (
    <Row icon={<DumbbellIcon />} label="Calculadora de discos" value={(prefs.bar ? "Barra " + prefs.bar + " kg" : "Sin barra") + (missing ? " · " + prefs.plates.length + " discos" : "")}
      open={open} onClick={onToggle}>
      <p className="set-hint">La calculadora usará tu barra y solo los discos que tenga tu gym.</p>
      <div className="set-sub">Tu barra</div>
      <div className="segmented" role="group" aria-label="Tu barra">
        {BAR_OPTIONS.map((b) => (
          <button key={b} type="button" aria-pressed={prefs.bar === b} onClick={() => setPlatePrefs({ ...prefs, bar: b })}>{b ? b + " kg" : "Sin barra"}</button>
        ))}
      </div>
      <div className="set-sub">Discos de tu gym</div>
      <div className="plate-chips" role="group" aria-label="Discos de tu gym">
        {ALL_PLATES.map((p) => (
          <button key={p} type="button" aria-pressed={prefs.plates.includes(p)} className={"plate-chip" + (prefs.plates.includes(p) ? " active" : "")} onClick={() => togglePlate(p)}>
            {fmt(p)} kg
          </button>
        ))}
      </div>
    </Row>
  );
}

// ---- Tú (con cuenta) ----

// Salir o no en «Quién levanta más» de tus grupos de amigos.
export function PrivacyRow({ open, onToggle }: RowProps) {
  const [hidden, setHidden] = useState<boolean | null>(null);
  const [message, setMessage] = useState<Message>(null);
  useEffect(() => {
    getLiftPrivacy().then((res) => {
      setHidden(res.ok ? !!res.data : false);
      if (!res.ok && res.error) setMessage({ ok: false, text: res.error });
    }).catch(() => setHidden(false));
  }, []);
  const change = async (show: boolean) => {
    setHidden(!show);
    setMessage(null);
    const res = await saveLiftPrivacy(!show).catch(() => ({ ok: false, error: "Sin conexión. Inténtalo de nuevo." }));
    if (!res.ok) { setHidden(show); setMessage({ ok: false, text: res.error ?? "No se pudo guardar." }); }
  };
  return (
    <Row icon={<ShieldIcon />} label="Privacidad en Social" value={hidden === null ? undefined : hidden ? "Pesos ocultos" : "Pesos visibles"} open={open} onClick={onToggle}>
      <label className="switch-row">
        <span><b>Salir en «Quién levanta más»</b><small>{hidden ? "Tus amigos no ven tus pesos" : "Tus amigos ven tu mejor serie de cada ejercicio"}</small></span>
        <input type="checkbox" role="switch" className="switch" checked={hidden === false} disabled={hidden === null} onChange={(e) => { void change(e.target.checked); }} />
      </label>
      <p className="set-hint">En la clasificación del mes sigues saliendo (solo cuenta los días que entrenas).</p>
      <Feedback message={message} />
    </Row>
  );
}

// ---- Cuenta ----

export function PasswordRow({ open, onToggle }: RowProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const res = await changePassword(password, confirm).catch(() => ({ ok: false, error: "Sin conexión. Inténtalo de nuevo." }));
    setBusy(false);
    if (res.ok) { setPassword(""); setConfirm(""); }
    setMessage(res.ok ? { ok: true, text: "Contraseña cambiada. Úsala la próxima vez que entres." } : { ok: false, text: res.error ?? "No se pudo cambiar." });
  };
  return (
    <Row icon={<LockIcon />} label="Cambiar contraseña" open={open} onClick={onToggle}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="form-label">Contraseña nueva
          <input type="password" autoComplete="new-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="form-label">Repite la contraseña
          <input type="password" autoComplete="new-password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <Feedback message={message} />
        <button type="submit" className="set-done" disabled={busy || password.length < 6 || !confirm}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </Row>
  );
}

export function EmailRow({ open, onToggle }: RowProps) {
  const { email: current } = useWorkout();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const res = await changeEmail(email).catch(() => ({ ok: false, error: "Sin conexión. Inténtalo de nuevo." }));
    setBusy(false);
    setMessage(res.ok ? { ok: true, text: "Te hemos enviado un enlace a " + email.trim() + ". Ábrelo para terminar el cambio." } : { ok: false, text: res.error ?? "No se pudo cambiar." });
  };
  return (
    <Row icon={<MailIcon />} label="Cambiar correo" open={open} onClick={onToggle}>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {current && <p className="set-hint">Ahora entras con <b>{current}</b>.</p>}
        <label className="form-label">Correo nuevo
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <Feedback message={message} />
        <button type="submit" className="set-done" disabled={busy || !email.includes("@")}>{busy ? "Enviando…" : "Enviar enlace de confirmación"}</button>
      </form>
    </Row>
  );
}

export function DeleteAccountRow({ open, onToggle }: RowProps) {
  const { actions } = useWorkout();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const ready = word.trim().toUpperCase() === "BORRAR";
  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const res = await deleteAccount().catch(() => ({ ok: false, error: "Sin conexión. Inténtalo de nuevo." }));
    if (res.ok) { actions.accountDeleted(); return; }
    setBusy(false);
    setMessage({ ok: false, text: res.error ?? "No se pudo borrar la cuenta." });
  };
  return (
    <Row icon={<TrashIcon />} label="Borrar cuenta" tone="danger" open={open} onClick={onToggle}>
      <p className="perm-warn">Se borrarán tu cuenta, tu rutina, todos tus registros y tus grupos. <b>No se puede deshacer.</b> Si quieres, descarga antes una copia en «Tus datos».</p>
      <form onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
        <label className="form-label">Escribe BORRAR para confirmar
          <input autoComplete="off" autoCapitalize="characters" value={word} onChange={(e) => setWord(e.target.value)} />
        </label>
        <Feedback message={message} />
        <button type="submit" className="set-done danger" disabled={!ready || busy}>{busy ? "Borrando…" : "Borrar mi cuenta para siempre"}</button>
      </form>
    </Row>
  );
}
