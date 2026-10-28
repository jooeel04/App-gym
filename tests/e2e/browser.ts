import { existsSync, readdirSync } from "node:fs";
import puppeteer, { type Browser, type Page } from "puppeteer-core";

// La app en marcha (`npm run dev`) con la base local y los datos demo (`npm run db:start`).
export const BASE_URL = process.env.E2E_URL ?? "http://localhost:3000";
const DEMO = { email: "demo@rutina.local", password: "demo1234" };

export interface Device { name: string; width: number; height: number }

export const PHONES: Device[] = [
  { name: "iPhone SE (1ª gen.)", width: 320, height: 568 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 15", width: 393, height: 852 },
  { name: "iPhone Pro Max", width: 440, height: 956 },
];
export const OTHER: Device[] = [
  { name: "iPhone en horizontal", width: 852, height: 393 },
  { name: "iPad mini", width: 744, height: 1133 },
];
export const TABS = ["/entrenar", "/rutina", "/progreso", "/ajustes"];

// Edge o Chrome instalados (o BROWSER_PATH). Las pruebas usan el navegador del equipo.
function browserPath() {
  if (process.env.BROWSER_PATH) return process.env.BROWSER_PATH;
  const fixed = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/microsoft-edge",
  ];
  const core = "C:/Program Files (x86)/Microsoft/EdgeCore";
  const versions = existsSync(core) ? readdirSync(core).sort().reverse().map((v) => `${core}/${v}/msedge.exe`) : [];
  const found = [...fixed, ...versions].find((p) => existsSync(p));
  if (!found) throw new Error("No encuentro Edge ni Chrome: indica la ruta en BROWSER_PATH.");
  return found;
}

export async function launch(): Promise<Browser> {
  const res = await fetch(BASE_URL + "/login").catch(() => null);
  if (!res?.ok) throw new Error(`La app no responde en ${BASE_URL}: arranca npm run db:start y npm run dev.`);
  return puppeteer.launch({ executablePath: browserPath(), headless: true });
}

export async function phonePage(browser: Browser, device: Device): Promise<Page> {
  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: device.width, height: device.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  return page;
}

export async function signIn(page: Page) {
  await page.goto(BASE_URL + "/login", { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', DEMO.email);
  await page.type('input[name="password"]', DEMO.password);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('button[value="signin"]')]);
}

export async function open(page: Page, path: string) {
  await page.goto(BASE_URL + path, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 300));
}

export async function setDevice(page: Page, device: Device) {
  await page.setViewport({ width: device.width, height: device.height, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
}

// Arrastra el dedo en horizontal sobre un punto de la pantalla.
export async function swipe(page: Page, fromX: number, toX: number, y: number) {
  const cdp = await page.createCDPSession();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: fromX, y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: fromX + ((toX - fromX) * i) / 12, y }] });
    await new Promise((r) => setTimeout(r, 16));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await new Promise((r) => setTimeout(r, 700));
  await cdp.detach();
}
