// Prueba de humo en navegador real (Chromium headless) para escritorio y celular.
// Uso: node tools/smoke.mjs [carpeta-capturas]
// Requiere Playwright (global o local). Levanta un servidor estático propio.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const ROOT = resolve('.');
const OUT = process.argv[2] || 'smoke-output';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const g = execSync('npm root -g').toString().trim();
    return createRequire(join(g, 'noop.js'))('playwright');
  }
}

const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
    const file = resolve(ROOT, path || 'index.html');
    if (!file.startsWith(ROOT)) throw new Error('fuera de raíz');
    const body = await readFile(file.endsWith('/') ? join(file, 'index.html') : file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const { chromium, devices } = await loadPlaywright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✔' : '✘'} ${msg}`);
  if (!ok) failures++;
};

async function run(name, ctxOpts, touch) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.waitForTimeout(800);
  // Cierra la ayuda de bienvenida
  const help = page.locator('#dlg-help');
  if (await help.isVisible()) await page.click('#dlg-help .btn.primary');
  await page.screenshot({ path: `${OUT}/${name}-1-inicio.png` });

  const hash = await page.evaluate(() => location.hash);
  check(hash.startsWith('#r='), `${name}: la URL guarda la habitación (${hash.length} chars)`);

  // Habitación vacía (acepta el confirm) para colocar sin obstáculos
  page.once('dialog', (d) => d.accept());
  await page.click('#btn-menu');
  await page.click('[data-action="new"]');
  await page.waitForTimeout(150);
  // Elegir un objeto y colocarlo en el centro del canvas
  const box = await page.locator('#view').boundingBox();
  await page.click('#cat-tabs [data-cat="deco"]');
  await page.click('#cat-grid .item-btn >> nth=0');
  const before = await page.evaluate(() => location.hash);
  const cx = box.x + box.width * 0.55;
  const cy = box.y + box.height * 0.62;
  if (touch) {
    await page.touchscreen.tap(cx, cy);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/${name}-2-preview.png` });
    await page.touchscreen.tap(cx, cy);
  } else {
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/${name}-2-preview.png` });
    await page.mouse.click(cx, cy);
  }
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => location.hash);
  check(after !== before, `${name}: colocar un objeto actualiza la habitación`);

  // Deshacer
  await page.click('#btn-undo');
  await page.waitForTimeout(100);
  check((await page.evaluate(() => location.hash)) === before, `${name}: deshacer vuelve al estado anterior`);

  // Volver a la habitación de ejemplo
  await page.keyboard.press('Escape');
  await page.click('#btn-menu');
  await page.click('[data-action="demo"]');
  await page.waitForTimeout(150);
  // Modo jugar: caminar
  await page.click('#tab-play');
  await page.waitForTimeout(200);
  check(await page.locator('#catalog').isHidden(), `${name}: el catálogo se oculta en modo jugar`);
  if (touch) await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.72);
  else await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.72);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}-3-jugar.png` });

  // Noche
  await page.click('#btn-night');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/${name}-4-noche.png` });

  // Link inválido no rompe nada
  await page.goto(`${base}#r=%3Cscript%3E`);
  await page.waitForTimeout(400);
  check(!errors.length, `${name}: sin errores de consola${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
await run('desktop', { viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 }, false);
await run('mobile', { ...devices['iPhone 13'], browserName: undefined, defaultBrowserType: undefined }, true);
await browser.close();
server.close();
console.log(failures ? `\n${failures} verificación(es) fallaron` : '\nTodo OK');
process.exit(failures ? 1 : 0);
