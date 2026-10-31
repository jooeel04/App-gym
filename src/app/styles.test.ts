import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Spec interfaz R5: en el CSS no quedan estilos que no use ninguna pantalla.
// Clases que se forman al vuelo ("from-" + dirección) o que pone una librería.
const DYNAMIC = ["from-right", "from-left", "glass__warp"];

const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? files(join(dir, e.name)) : /\.(tsx?|js)$/.test(e.name) && !/\.test\./.test(e.name) ? [join(dir, e.name)] : []);

describe("Interfaz · CSS sin estilos muertos", () => {
  it("cada clase del CSS la usa alguna pantalla", () => {
    const css = readFileSync("src/app/globals.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const classes = new Set([...css.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]));
    const code = [...files("src"), "public/sw.js"].map((f) => readFileSync(f, "utf8")).join("\n");
    const used = (c: string) => new RegExp("(^|[^\w-])" + c + "([^\w-]|$)").test(code);
    expect([...classes].filter((c) => !DYNAMIC.includes(c) && !used(c))).toEqual([]);
  });
});
