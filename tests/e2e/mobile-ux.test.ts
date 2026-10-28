import type { Browser, Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launch, open, OTHER, PHONES, phonePage, setDevice, signIn, swipe, TABS } from "./browser";

const MIN_TARGET = 44; // px: lo mínimo cómodo para un dedo (Apple 44 pt, Material 48 dp)
const MIN_TEXT = 11; // px: el texto más pequeño legible de un vistazo

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await launch();
  page = await phonePage(browser, PHONES[2]);
  await signIn(page);
});
afterAll(async () => { await browser?.close(); });

// Lo que sobresale del ancho de la pantalla fuera de una zona deslizable.
const overflowing = (vw: number) => {
  const out: string[] = [];
  for (const el of document.querySelectorAll("main *, .nav, .topbar")) {
    const r = el.getBoundingClientRect();
    if (!r.width || (r.right <= vw + 1 && r.left >= -1)) continue;
    let scroller = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(p).overflowX) || p.classList.contains("peek")) { scroller = true; break; }
    }
    if (!scroller) out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ")[0]} [${Math.round(r.left)}→${Math.round(r.right)}]`);
  }
  return [...new Set(out)].slice(0, 8);
};

// Controles visibles más pequeños que `min` en alto o en ancho.
const smallTargets = (min: number) => {
  const out: string[] = [];
  const sel = "main button, main a[href], main summary, main input:not([type=hidden]), main select, main [role=button], main [role=tab], .nav button";
  for (const el of document.querySelectorAll(sel)) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || s.visibility === "hidden") continue;
    if (r.width < min || r.height < min) {
      const name = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 24);
      out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ")[0]} «${name}» ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  }
  return [...new Set(out)];
};

// Textos visibles (propios del elemento) con letra más pequeña que `min`.
const tinyText = (min: number) => {
  const out: string[] = [];
  for (const el of document.querySelectorAll("main *")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!r.width || s.visibility === "hidden" || s.display === "none") continue;
    const size = parseFloat(s.fontSize);
    if (size < min - 0.05) out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute("class") ?? "").split(" ")[0]} «${el.textContent!.trim().slice(0, 20)}» ${size.toFixed(1)}px`);
  }
  return [...new Set(out)];
};

describe("Nada se sale de la pantalla", () => {
  for (const device of [...PHONES, ...OTHER]) {
    it(`${device.name} (${device.width}×${device.height})`, async () => {
      await setDevice(page, device);
      for (const tab of TABS) {
        await open(page, tab);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), tab).toBeLessThanOrEqual(device.width);
        expect(await page.evaluate(overflowing, device.width), tab).toEqual([]);
      }
    });
  }
});

describe("Botones cómodos para el dedo (mín. 44 px)", () => {
  for (const device of [PHONES[1], PHONES[2]]) {
    for (const tab of TABS) {
      it(`${tab} en ${device.name}`, async () => {
        await setDevice(page, device);
        await open(page, tab);
        expect(await page.evaluate(smallTargets, MIN_TARGET)).toEqual([]);
      });
    }
  }
});

describe("Textos legibles (mín. 11 px)", () => {
  for (const device of [PHONES[0], PHONES[2]]) {
    for (const tab of TABS) {
      it(`${tab} en ${device.name}`, async () => {
        await setDevice(page, device);
        await open(page, tab);
        expect(await page.evaluate(tinyText, MIN_TEXT)).toEqual([]);
      });
    }
  }
});

describe("Barra de pestañas con cristal líquido (liquid-glass-react)", () => {
  it("lleva el efecto y las pestañas siguen funcionando con el dedo", async () => {
    await setDevice(page, PHONES[2]);
    await open(page, "/entrenar");
    await page.waitForSelector(".nav .glass-layer.on filter", { timeout: 10_000 });
    // El cristal es solo fondo: no tapa los toques a las pestañas.
    expect(await page.$eval(".nav .glass-layer", (el) => getComputedStyle(el).pointerEvents)).toBe("none");
    // Y ve lo que hay detrás: la barra no se desenfoca ella misma y nada dentro del cristal
    // mezcla colores (mix-blend-mode aísla el grupo y anula el desenfoque).
    const glass = await page.$eval(".nav", (nav) => ({
      bar: getComputedStyle(nav).backdropFilter,
      warp: getComputedStyle(nav.querySelector(".glass__warp")!).backdropFilter,
      blends: [...nav.querySelectorAll(".glass-layer *")].map((el) => getComputedStyle(el).mixBlendMode).filter((m) => m !== "normal"),
    }));
    expect(glass.bar).toBe("none");
    expect(glass.warp).toContain("blur");
    expect(glass.blends).toEqual([]);
    const rutina = (await page.$$(".nav a"))[1];
    await rutina.tap();
    await page.waitForFunction(() => location.pathname === "/rutina");
    // La pestaña marcada se actualiza al terminar el deslizamiento entre pestañas.
    await page.waitForFunction(() => document.querySelector(".nav a[aria-current=page]")?.textContent === "Rutina", { timeout: 5_000 });
    expect(await page.$eval(".nav a[aria-current=page]", (el) => el.textContent)).toBe("Rutina");
  });
});

describe("Progreso · Tus ejercicios", () => {
  it("empieza plegado, se despliega al tocar y la gráfica se desliza con el dedo", async () => {
    await setDevice(page, PHONES[2]);
    await open(page, "/progreso");
    const rows = await page.$$(".exprog-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(await page.$$eval(".exprog-row[aria-expanded=true]", (els) => els.length)).toBe(0);
    expect(await page.$$(".exprog .spark-scroll")).toHaveLength(0);

    await rows[0].tap();
    await new Promise((r) => setTimeout(r, 400));
    expect(await rows[0].evaluate((el) => el.getAttribute("aria-expanded"))).toBe("true");
    const chart = await page.$(".exprog .spark-scroll.scrollable");
    expect(chart).not.toBeNull();

    await chart!.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await new Promise((r) => setTimeout(r, 300));
    const box = (await chart!.boundingBox())!;
    const before = await chart!.evaluate((e) => e.scrollLeft);
    await swipe(page, box.x + 30, box.x + box.width - 10, box.y + box.height / 2);
    expect(await chart!.evaluate((e) => e.scrollLeft)).toBeLessThan(before);
    expect(new URL(page.url()).pathname).toBe("/progreso");
  });
});
