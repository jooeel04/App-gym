"use client";

import { useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useWorkout } from "@/controllers/workout-controller";
import { currentTheme, setTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { ChevronIcon, DatabaseIcon, DownloadIcon, LogoutIcon, MoonIcon, TableIcon, TrashIcon, UploadIcon, UserIcon } from "./icons";

const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: "dark", label: "Oscuro", hint: "Fondo negro" },
  { value: "light", label: "Claro", hint: "Fondo blanco" },
];

function SettingsCard({ icon, title, text, tone, children }: { icon: ReactNode; title: string; text: string; tone?: "danger"; children: ReactNode }) {
  return (
    <section className={"settings-card" + (tone ? " " + tone : "")}>
      <header className="settings-head">
        <span className="settings-icon">{icon}</span>
        <div><h2>{title}</h2><p>{text}</p></div>
      </header>
      {children}
    </section>
  );
}

function SettingsRow({ icon, title, text, onClick, tone }: { icon: ReactNode; title: string; text: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button type="button" className={"settings-row" + (tone ? " " + tone : "")} onClick={onClick}>
      <span className="row-icon">{icon}</span>
      <span className="row-text"><strong>{title}</strong><small>{text}</small></span>
      <span className="row-chev"><ChevronIcon /></span>
    </button>
  );
}

// Vista "Ajustes": apariencia (claro u oscuro), cuenta y herramientas de datos.
export function SettingsView() {
  const { mode, email, sync, actions } = useWorkout();
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "dark" as Theme);
  const fileInput = useRef<HTMLInputElement>(null);
  const cloud = mode === "cloud";
  const syncText = sync.offline
    ? "Sin conexión" + (sync.pending ? " · " + sync.pending + " cambios por enviar" : "")
    : sync.pending ? "Guardando…" : "Todo guardado en tu cuenta";

  return (
    <section className="view active">
      <div className="pagehead">
        <div>
          <div className="eyebrow">Tu app</div>
          <h1>Ajustes</h1>
          <p className="lede">Elige cómo se ve la app, gestiona tu cuenta y guarda tus datos.</p>
        </div>
      </div>

      <div className="settings">
        <SettingsCard icon={<MoonIcon />} title="Apariencia" text="Se guarda en este dispositivo.">
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
        </SettingsCard>

        {cloud && email && (
          <SettingsCard icon={<UserIcon />} title="Tu cuenta" text="Tus registros solo los ves tú.">
            <div className="account-row">
              <span className="avatar" aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
              <div className="account-text">
                <strong>{email}</strong>
                <small className={sync.offline ? "warn" : ""}><i className={"sync-dot" + (sync.offline ? " offline" : sync.pending ? " busy" : "")} />{syncText}</small>
              </div>
            </div>
            <button type="button" className="settings-btn" onClick={actions.signOut}><LogoutIcon />Cerrar sesión</button>
          </SettingsCard>
        )}

        <SettingsCard icon={<DatabaseIcon />} title="Tus datos"
          text={cloud ? "Guarda una copia en tu dispositivo o recupera una anterior." : "Están solo en este navegador: descarga una copia para no perderlos."}>
          <div className="settings-list">
            <SettingsRow icon={<DownloadIcon />} title="Descargar copia" text="Archivo JSON con todos tus registros" onClick={actions.exportJson} />
            <SettingsRow icon={<TableIcon />} title="Exportar a CSV" text="Para abrirlo en Excel o Google Sheets" onClick={actions.exportCsv} />
            <SettingsRow icon={<UploadIcon />} title="Restaurar copia" text="Sustituye tus datos por una copia JSON" onClick={() => fileInput.current?.click()} />
          </div>
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
        </SettingsCard>

        <SettingsCard icon={<TrashIcon />} title="Zona peligrosa" text="Estas acciones no se pueden deshacer." tone="danger">
          <div className="settings-list">
            <SettingsRow icon={<TrashIcon />} title="Borrar registros" text="Elimina series, ticks y días completados" onClick={actions.clearData} tone="danger" />
          </div>
        </SettingsCard>

        <p className="settings-foot">RUTINA · Seguimiento</p>
      </div>
    </section>
  );
}
