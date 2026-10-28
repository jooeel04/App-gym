// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlassLayer } from "./glass-layer";

// En el servidor no existe `navigator`, que la librería lee al pintarse: el cristal
// solo se carga en el navegador y la página del servidor sale sin él.
describe("GlassLayer en el servidor", () => {
  it("se pinta sin errores y sin el efecto", () => {
    const html = renderToString(<nav><GlassLayer radius={32} /></nav>);
    expect(html).toContain("glass-layer");
    expect(html).not.toContain("<filter");
  });
});
