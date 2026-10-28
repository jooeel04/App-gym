"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { restFinishedAlert, unlockAudio } from "@/lib/alerts";
import { ALERT_OPTIONS, BEFORE_OPTIONS, DEFAULT_REST, formatRest, getRestPrefs, REST_OPTIONS, setRestPrefs, subscribePrefs } from "@/lib/preferences";
import { currentTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { BellIcon, ChevronIcon, ClockIcon, DownloadIcon, LogoutIcon, MoonIcon, TableIcon, TrashIcon, UploadIcon, UsersIcon } from "./icons";
import { LeaderboardCard } from "./leaderboard";

const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "dark", label: "Oscuro", hint: "Fondo negro" },
  { value: "light", label: "Claro", hint: "Fondo blanco" },
];

// Grupo de filas con un título pequeño encima (como los Ajustes del iPhone).
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set-group">
      <h2>{title}</h2>
      <div className="set-box">{children}</div>
    </section>
  );
}

// Fila: con `children` se despliega al tocarla; sin ellos ejecuta `onClick`.
function Row({ icon, label, value, open, onClick, tone, children }: {
  icon: ReactNode; label: string; value?: string; open?: boolean; onClick: () => void; tone?: "danger"; children?: ReactNode;
}) {
  return (
    <div className={"set-item" + (open ? " open" : "")}>
      <button type="button" className={"set-row" + (tone ? " " + tone : "")} onClick={onClick} aria-expanded={children ? !!open : undefined}>
        <span className="set-icon">{icon}</span>
        <span className="set-label">{label}</span>
        {value && <span className="set-value">{value}</span>}
        <span className="set-chev"><ChevronIcon /></span>
      </button>
      {open && children && <div className="set-panel">{children}</div>}
    </div>
  );
}

// Vista "Ajustes": lista agrupada (entreno, app, datos y cuenta). Las filas con
// opciones se despliegan en el sitio.
export function SettingsView() {
  const { mode, email, sync, actions } = useWorkout();
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "dark" as Theme);
  const rest = useSyncExternalStore(subscribePrefs, getRestPrefs, () => DEFAULT_REST);
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

        <Group title="Entreno">
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
                <button type="button" className="settings-btn" onClick={() => { unlockAudio(); restFinishedAlert(rest.alert); }}>
                  <BellIcon />Probar el aviso
                </button>
              </>
            )}
          </Row>
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
          {cloud && (
            <Row icon={<UsersIcon />} label="Amigos y clasificación" open={open === "friends"} onClick={toggle("friends")}>
              <LeaderboardCard />
            </Row>
          )}
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
          {cloud && <Row icon={<LogoutIcon />} label="Cerrar sesión" onClick={actions.signOut} />}
          <Row icon={<TrashIcon />} label="Borrar registros" onClick={actions.clearData} tone="danger" />
        </Group>

        <p className="settings-foot">RUTINA · Seguimiento</p>
      </div>
    </section>
  );
}
