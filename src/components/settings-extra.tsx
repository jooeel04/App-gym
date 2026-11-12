"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { changeEmail, changePassword, deleteAccount, getLiftPrivacy, saveLiftPrivacy } from "@/app/actions/account";
import { createWatchToken, deleteWatchToken, watchTokenStatus } from "@/app/actions/watch";
import { useWorkout } from "@/controllers/workout-controller";
import { APP_VERSION, BUILD_DATE, NOVEDADES } from "@/lib/novedades";
import { ALL_PLATES, BAR_OPTIONS, DEFAULT_ENERGY, DEFAULT_PLATES, getEnergyPrefs, getPlatePrefs, setEnergyPrefs, setPlatePrefs, subscribePrefs } from "@/lib/preferences";
import { getTextSize, setTextSize, subscribeTheme, type TextSize } from "@/lib/theme";
import { DumbbellIcon, FlameIcon, InfoIcon, LockIcon, MailIcon, ShieldIcon, TextSizeIcon, TrashIcon } from "./icons";
import { PlateCalculator } from "./plate-calculator";
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

// La barra y los discos de tu gym, y «Abrir calculadora»: es el único sitio donde se abre la
// calculadora de discos (spec ajustes R6–R7).
export function PlatesRow({ open, onToggle }: RowProps) {
  const prefs = useSyncExternalStore(subscribePrefs, getPlatePrefs, () => DEFAULT_PLATES);
  const [calculator, setCalculator] = useState(false);
  const togglePlate = (p: number) => {
    const plates = prefs.plates.includes(p) ? prefs.plates.filter((x) => x !== p) : [...prefs.plates, p];
    if (plates.length) setPlatePrefs({ ...prefs, plates });
  };
  const missing = ALL_PLATES.length - prefs.plates.length;
  return (
    <Row icon={<DumbbellIcon />} label="Calculadora de discos" value={(prefs.bar ? "Barra " + prefs.bar + " kg" : "Sin barra") + (missing ? " · " + prefs.plates.length + " discos" : "")}
      open={open} onClick={onToggle}>
      <button type="button" className="settings-btn" onClick={() => setCalculator(true)}><DumbbellIcon />Abrir calculadora</button>
      {calculator && <PlateCalculator onClose={() => setCalculator(false)} />}
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

// Calorías (spec ajustes R8): si se apuntan a mano las kcal del reloj. Sin activarlo, solo
// se ve la estimación.
export function EnergyRow({ open, onToggle, cloud }: RowProps & { cloud: boolean }) {
  const prefs = useSyncExternalStore(subscribePrefs, getEnergyPrefs, () => DEFAULT_ENERGY);
  return (
    <Row icon={<FlameIcon />} label="Calorías" value={prefs.watchInput ? "Con el reloj" : "Estimadas"} open={open} onClick={onToggle}>
      <label className="switch-row">
        <span><b>Apuntar las kcal del reloj</b><small>En el resumen del entreno y en el calendario</small></span>
        <input type="checkbox" role="switch" className="switch" checked={prefs.watchInput} onChange={(e) => setEnergyPrefs({ ...prefs, watchInput: e.target.checked })} />
      </label>
      <p className="set-hint">Sin reloj, la app estima las calorías con tu peso y tus series (≈).</p>
      {cloud && <WatchShortcut />}
    </Row>
  );
}

// Atajo de iPhone (spec ajustes R9): crea la clave de la cuenta y enseña los pasos para que
// el atajo mande solo las kcal del Apple Watch a /api/reloj. La clave se ve una sola vez.
function WatchShortcut() {
  const [active, setActive] = useState<boolean | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  useEffect(() => {
    watchTokenStatus().then((res) => setActive(res.ok ? !!res.data : false)).catch(() => setActive(false));
  }, []);
  const run = async (create: boolean) => {
    setBusy(true);
    setMessage(null);
    const res = await (create ? createWatchToken() : deleteWatchToken()).catch(() => ({ ok: false, data: null, error: "Sin conexión. Inténtalo de nuevo." }));
    setBusy(false);
    if (!res.ok) { setMessage({ ok: false, text: res.error ?? "No se pudo guardar." }); return; }
    setActive(create);
    setToken(create ? (res.data as string) : null);
  };
  const copy = () => { void navigator.clipboard?.writeText(token ?? "").then(() => setMessage({ ok: true, text: "Clave copiada" })); };
  const url = (typeof window === "undefined" ? "" : window.location.origin) + "/api/reloj";
  return (
    <div className="watch-shortcut">
      <div className="set-sub">Atajo de iPhone</div>
      <p className="set-hint">Con un atajo, las kcal del Apple Watch llegan solas al acabar cada entreno.</p>
      {token ? (
        <>
          <p className="set-hint">Tu clave (solo se enseña ahora; guárdala en el atajo):</p>
          <code className="watch-token">{token}</code>
          <button type="button" className="settings-btn" onClick={copy}>Copiar clave</button>
          <ol className="watch-steps" aria-label="Pasos del atajo">
            <li>Abre <b>Atajos</b> → <b>Automatización</b> → <b>+</b>.</li>
            <li>Elige <b>Entreno de Apple Watch</b> → <b>Termina</b> → <b>Ejecutar inmediatamente</b> → <b>Nuevo atajo en blanco</b>.</li>
            <li>Añade <b>Buscar muestras de salud</b>: tipo <b>Energía activa</b>, fecha de inicio <b>en las últimas 2 horas</b>.</li>
            <li>Añade <b>Calcular estadísticas</b> → <b>Suma</b>.</li>
            <li>Añade <b>Obtener contenido de URL</b>: <code>{url}</code>, método <b>POST</b>, encabezado <b>Authorization</b> = <code>Bearer</code> + espacio + tu clave, cuerpo <b>JSON</b> con <b>kcal</b> = la suma.</li>
          </ol>
        </>
      ) : active ? <p className="perm-ok" role="status">Tienes una clave activa</p> : null}
      <div className="watch-actions">
        {active !== null && <button type="button" className="settings-btn" disabled={busy} onClick={() => { void run(true); }}>{active ? "Crear otra" : "Crear mi clave"}</button>}
        {active && <button type="button" className="remove-ex" disabled={busy} onClick={() => { void run(false); }}>Borrar clave</button>}
      </div>
      <Feedback message={message} />
    </div>
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
