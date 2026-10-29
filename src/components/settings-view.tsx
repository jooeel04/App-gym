"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { restFinishedAlert } from "@/lib/alerts";
import { needsHomeScreen, notifyState, requestPermissions, showNotification, subscribePermission, type NotifyState } from "@/lib/permissions";
import { ALERT_OPTIONS, BEFORE_OPTIONS, DEFAULT_REST, formatRest, getRestPrefs, REST_OPTIONS, setRestPrefs, subscribePrefs } from "@/lib/preferences";
import { getThemePref, setTheme, subscribeTheme, type ThemePref } from "@/lib/theme";
import { BellIcon, CheckIcon, ClockIcon, DownloadIcon, LogoutIcon, MoonIcon, TableIcon, TrashIcon, UploadIcon, UserIcon } from "./icons";
import { cleanNickname } from "@/lib/nickname";
import { ReminderRow } from "./reminder-settings";
import { DeleteAccountRow, EmailRow, PasswordRow, PlatesRow, PrivacyRow, TextSizeRow, VersionRow } from "./settings-extra";
import { Group, Row } from "./settings-rows";

const PERMISSION_LABEL: Record<NotifyState, string> = {
  granted: "Activados",
  default: "Sin dar",
  denied: "Bloqueados",
  unsupported: "No disponibles",
};

const THEMES: { value: ThemePref; label: string; hint: string }[] = [
  { value: "auto", label: "Automático", hint: "Como tu móvil" },
  { value: "dark", label: "Oscuro", hint: "Fondo negro" },
  { value: "light", label: "Claro", hint: "Fondo blanco" },
];

// Vista "Ajustes": lista agrupada (entreno, app, datos y cuenta). Las filas con
// opciones se despliegan en el sitio.
export function SettingsView() {
  const { mode, email, sync, nickname, actions } = useWorkout();
  const theme = useSyncExternalStore(subscribeTheme, getThemePref, () => "auto" as ThemePref);
  const rest = useSyncExternalStore(subscribePrefs, getRestPrefs, () => DEFAULT_REST);
  const permission = useSyncExternalStore(subscribePermission, notifyState, () => "default" as NotifyState);
  const homeScreen = useSyncExternalStore(subscribePermission, needsHomeScreen, () => false);
  const [open, setOpen] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cloud = mode === "cloud";
  const toggle = (id: string) => () => setOpen(open === id ? null : id);
  const syncText = sync.offline
    ? "Sin conexión" + (sync.pending ? " · " + sync.pending + " cambios por enviar" : "")
    : sync.pending ? "Guardando…" : "Todo guardado en tu cuenta";
  const alertLabel = ALERT_OPTIONS.find((o) => o.value === rest.alert)?.label ?? "";
  const beforeLabel = (s: number) => (s ? s + " s antes" : "Al terminar");

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu app</div>
          <h1>Ajustes</h1>
        </div>
      </div>

      <div className="settings">
        {cloud && email && (
          <div className="set-account">
            <span className="avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
            <div className="account-text">
              <strong>{email}</strong>
              <small className={sync.offline ? "warn" : ""}><i className={"sync-dot" + (sync.offline ? " offline" : sync.pending ? " busy" : "")} />{syncText}</small>
            </div>
          </div>
        )}

        <Group title="Tú">
          <Row icon={<UserIcon />} label="Tu nombre" value={nickname ?? "Sin poner"} open={open === "name"} onClick={toggle("name")}>
            <NicknameEditor key={nickname ?? ""} onSaved={() => setOpen(null)} />
          </Row>
          {cloud && <PrivacyRow open={open === "privacy"} onToggle={toggle("privacy")} />}
        </Group>

        <Group title="Entreno">
          {cloud && <ReminderRow open={open === "reminder"} onToggle={toggle("reminder")} />}
          <Row icon={<CheckIcon />} label="Permisos" value={PERMISSION_LABEL[permission]} open={open === "perms"} onClick={toggle("perms")}>
            <p className="set-hint">Para avisarte cuando acaba el descanso, la app necesita poder mandarte notificaciones, sonar y vibrar. La pantalla se mantiene encendida mientras entrenas.</p>
            {permission === "granted" && <p className="perm-ok"><CheckIcon /> Todo listo: te avisará aunque estés en otra app.</p>}
            {permission === "default" && (
              <button type="button" className="set-done" onClick={() => { void requestPermissions(); }}><BellIcon />Dar permisos</button>
            )}
            {permission === "denied" && (
              <p className="perm-warn">Las notificaciones están bloqueadas. Para activarlas: abre los <b>Ajustes del móvil</b> → busca el navegador o la app <b>FitGym</b> → <b>Notificaciones</b> → activa «Permitir». Después vuelve aquí.</p>
            )}
            {permission === "unsupported" && homeScreen && (
              <p className="perm-warn">En iPhone las notificaciones solo funcionan si la app está en la pantalla de inicio:<br />1. Abre la app en <b>Safari</b>.<br />2. Toca el botón <b>Compartir</b> (el cuadrado con la flecha).<br />3. Elige <b>«Añadir a pantalla de inicio»</b>.<br />4. Abre la app desde ese icono y vuelve aquí.</p>
            )}
            {permission === "unsupported" && !homeScreen && (
              <p className="perm-warn">Este navegador no permite notificaciones. El aviso sonará y vibrará mientras tengas la app abierta.</p>
            )}
            {permission === "granted" && (
              <button type="button" className="settings-btn" onClick={() => {
                void requestPermissions();
                setTimeout(() => { void showNotification("Así te avisará", "Cuando acabe el descanso verás este mensaje"); }, 3000);
              }}>
                <BellIcon />Probar notificación (en 3 s)
              </button>
            )}
          </Row>
          <Row icon={<ClockIcon />} label="Descanso entre series" value={rest.enabled ? formatRest(rest.seconds) : "Desactivado"}
            open={open === "rest"} onClick={toggle("rest")}>
            <p className="set-hint">Al anotar las repeticiones empieza una cuenta atrás.</p>
            <label className="switch-row">
              <span><b>Temporizador automático</b><small>{rest.enabled ? "Activado" : "Desactivado"}</small></span>
              <input type="checkbox" role="switch" className="switch" checked={rest.enabled} onChange={(e) => setRestPrefs({ ...rest, enabled: e.target.checked })} />
            </label>
            <div className="rest-options" role="radiogroup" aria-label="Duración del descanso">
              {REST_OPTIONS.map((s) => (
                <button key={s} type="button" role="radio" aria-checked={rest.seconds === s} disabled={!rest.enabled}
                  className={"rest-option" + (rest.seconds === s ? " active" : "")} onClick={() => setRestPrefs({ ...rest, seconds: s })}>
                  {formatRest(s)}
                </button>
              ))}
            </div>
          </Row>
          <Row icon={<BellIcon />} label="Aviso del descanso"
            value={!rest.enabled || rest.alert === "off" ? "Desactivado" : alertLabel + (rest.before ? " · " + rest.before + " s antes" : "")}
            open={open === "alert"} onClick={toggle("alert")}>
            {!rest.enabled && <p className="set-hint">Activa el temporizador automático en «Descanso entre series» para recibir el aviso.</p>}
            <div className="set-sub">Cómo te avisa</div>
            {cloud && <p className="set-hint">En iPhone, la vibración y el sonido llegan con una notificación (aunque tengas el móvil bloqueado): da permiso en «Permisos». Con el móvil en silencio solo vibra.</p>}
            <div className="choice-list" role="radiogroup" aria-label="Cómo te avisa">
              {ALERT_OPTIONS.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={rest.alert === o.value}
                  className={"choice" + (rest.alert === o.value ? " active" : "")} onClick={() => setRestPrefs({ ...rest, alert: o.value })}>
                  {o.label}<span className="choice-check" aria-hidden="true">✓</span>
                </button>
              ))}
            </div>
            {rest.alert !== "off" && (
              <>
                <div className="set-sub">Cuándo te avisa</div>
                <div className="segmented" role="radiogroup" aria-label="Cuándo te avisa">
                  {BEFORE_OPTIONS.map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={rest.before === s}
                      onClick={() => setRestPrefs({ ...rest, before: s })}>
                      {beforeLabel(s)}
                    </button>
                  ))}
                </div>
                <button type="button" className="settings-btn" onClick={() => { void requestPermissions(); restFinishedAlert(rest.alert); }}>
                  <BellIcon />Probar el aviso
                </button>
              </>
            )}
          </Row>
          <PlatesRow open={open === "plates"} onToggle={toggle("plates")} />
        </Group>

        <Group title="App">
          <Row icon={<MoonIcon />} label="Apariencia" value={THEMES.find((t) => t.value === theme)?.label} open={open === "theme"} onClick={toggle("theme")}>
            <div className="theme-options" role="radiogroup" aria-label="Tema">
              {THEMES.map((t) => (
                <button key={t.value} type="button" role="radio" aria-checked={theme === t.value}
                  className={"theme-option" + (theme === t.value ? " active" : "")} onClick={() => setTheme(t.value)}>
                  <span className={"theme-preview " + t.value} aria-hidden="true">
                    <i className="tp-bar" /><i className="tp-card" /><i className="tp-card short" /><i className="tp-dot" />
                  </span>
                  <span className="theme-label"><strong>{t.label}</strong><small>{t.hint}</small></span>
                  <span className="theme-check" aria-hidden="true">✓</span>
                </button>
              ))}
            </div>
          </Row>
          <TextSizeRow open={open === "text"} onToggle={toggle("text")} />
          <VersionRow open={open === "version"} onToggle={toggle("version")} />
        </Group>

        <Group title="Tus datos">
          <Row icon={<DownloadIcon />} label="Descargar copia" onClick={actions.exportJson} />
          <Row icon={<TableIcon />} label="Exportar a Excel (CSV)" onClick={actions.exportCsv} />
          <Row icon={<UploadIcon />} label="Restaurar copia" onClick={() => fileInput.current?.click()} />
        </Group>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) actions.importFile(file);
            e.target.value = "";
          }}
        />
        <p className="set-note">{cloud ? "La copia es un archivo con todos tus registros, por si quieres guardarla aparte." : "Tus datos están solo en este navegador: descarga una copia para no perderlos."}</p>

        <Group title="Cuenta">
          {cloud && <PasswordRow open={open === "password"} onToggle={toggle("password")} />}
          {cloud && <EmailRow open={open === "email"} onToggle={toggle("email")} />}
          {cloud && <Row icon={<LogoutIcon />} label="Cerrar sesión" onClick={actions.signOut} />}
          <Row icon={<TrashIcon />} label="Borrar registros" onClick={actions.clearData} tone="danger" />
          {cloud && <DeleteAccountRow open={open === "delete"} onToggle={toggle("delete")} />}
        </Group>

        <p className="settings-foot">FitGym · Tu entreno</p>
      </div>
    </section>
  );
}

// Cambiar el nombre o apodo con el que la app se dirige a la persona.
function NicknameEditor({ onSaved }: { onSaved: () => void }) {
  const { nickname, actions } = useWorkout();
  const [value, setValue] = useState(nickname ?? "");
  const ok = cleanNickname(value).length > 0 && cleanNickname(value) !== nickname;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok && actions.setNickname(value)) onSaved(); }}>
      <p className="set-hint">Así te llama la app y así te ven tus amigos en la clasificación.</p>
      <label className="form-label">Tu nombre o apodo
        <input name="nickname" maxLength={30} autoComplete="nickname" value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button type="submit" className="set-done" disabled={!ok}>Guardar nombre</button>
    </form>
  );
}
