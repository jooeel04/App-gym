import type { ReactNode } from "react";
import { ChevronIcon } from "./icons";

// Grupo de filas con un título pequeño encima (como los Ajustes del iPhone).
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set-group">
      <h2>{title}</h2>
      <div className="set-box">{children}</div>
    </section>
  );
}

// Fila: con `children` se despliega al tocarla; sin ellos ejecuta `onClick`.
export function Row({ icon, label, value, open, onClick, tone, children }: {
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
