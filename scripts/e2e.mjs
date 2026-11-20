import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const outDir = path.resolve('evidence');
mkdirSync(outDir, { recursive: true });
const consoleLog = [];
const pageErrors = [];
const failed = [];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--ignore-gpu-blocklist',
    '--window-size=1440,900',
  ],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
page.on('console', (message) => consoleLog.push({ type: message.type(), text: message.text() }));
page.on('pageerror', (error) => pageErrors.push(String(error)));
page.on('requestfailed', (request) => failed.push(`${request.url()} ${request.failure()?.errorText ?? ''}`));
page.on('response', (response) => {
  if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
});

await fetch('http://127.0.0.1:4318/api/control', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reset: true }),
});
await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('[data-testid="sample-seq"]');
await page.waitForFunction(() => document.querySelector('canvas.webgl') !== null, { timeout: 20000 });
await new Promise((resolve) => setTimeout(resolve, 2500));

const first = await page.evaluate(() => ({
  title: document.title,
  seq: document.querySelector('[data-testid="sample-seq"]')?.textContent,
  link: document.querySelector('[data-testid="link-status"]')?.textContent,
  twin: window.__TWIN__,
  canvas: (() => {
    const canvas = document.querySelector('canvas.webgl');
    return canvas ? { width: canvas.width, height: canvas.height } : null;
  })(),
}));
await page.screenshot({ path: path.join(outDir, '01-overview-rain.png') });
await page.click('[data-testid="asset-T-101"]');
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === '定位');
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 600));
await page.screenshot({ path: path.join(outDir, '05-close-tower.png') });
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === '运行总览');
  button?.click();
});
await page.waitForSelector('[data-testid="view-home"]');
await page.click('[data-testid="view-home"]');

const seqA = first.twin?.seq;
await new Promise((resolve) => setTimeout(resolve, 3400));
const mid = await page.evaluate(() => window.__TWIN__);
const seqB = mid?.seq;
const flowA = mid?.frame?.assets?.['P-401']?.flow?.value;

async function setSlider(selector, value) {
  await page.$eval(selector, (element, next) => {
    const prototype = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    prototype?.set?.call(element, String(next));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
await page.click('[data-testid="asset-T-101"]');
await new Promise((resolve) => setTimeout(resolve, 400));
await setSlider('[data-testid="detail-load-slider"]', 20);
await new Promise((resolve) => setTimeout(resolve, 900));
const lowLoad = await page.evaluate(() => window.__TWIN__?.frame?.assets?.['P-401']?.flow?.value);
await setSlider('[data-testid="detail-load-slider"]', 95);
await new Promise((resolve) => setTimeout(resolve, 900));
const highLoad = await page.evaluate(() => window.__TWIN__?.frame);

await setSlider('[data-testid="detail-load-slider"]', 78);
await page.click('[data-testid="asset-T-102"]');
await new Promise((resolve) => setTimeout(resolve, 400));
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('故障演练'));
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 9000));
const faulted = await page.evaluate(() => ({
  fault: window.__TWIN__?.frame?.fault,
  stress: window.__TWIN__?.frame?.stress,
  t102: window.__TWIN__?.frame?.assets?.['T-102'],
  cw: window.__TWIN__?.frame?.assets?.['CW-301']?.status,
  drum: window.__TWIN__?.frame?.assets?.['V-301']?.status,
  name: document.querySelector('[data-testid="bottom-name"]')?.textContent,
}));
await page.click('[data-testid="asset-T-102"]');
await new Promise((resolve) => setTimeout(resolve, 400));
await page.screenshot({ path: path.join(outDir, '02-selected-T-102.png') });

await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === '恢复');
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 5000));
const recovered = await page.evaluate(() => ({
  fault: window.__TWIN__?.frame?.fault,
  stress: window.__TWIN__?.frame?.stress,
  t102: window.__TWIN__?.frame?.assets?.['T-102']?.status,
  cw: window.__TWIN__?.frame?.assets?.['CW-301']?.status,
  drum: window.__TWIN__?.frame?.assets?.['V-301']?.status,
}));

await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((item) => item.textContent === '运行总览');
  button?.click();
});
await page.click('[data-testid="pause-button"]');
await new Promise((resolve) => setTimeout(resolve, 2000));
const pausedA = await page.evaluate(() => window.__TWIN__?.frame?.seq);
await new Promise((resolve) => setTimeout(resolve, 2000));
const pausedB = await page.evaluate(() => ({ seq: window.__TWIN__?.frame?.seq, paused: window.__TWIN__?.frame?.paused }));
await page.click('[data-testid="pause-button"]');
await page.click('[data-testid="open-weather"]');
await page.click('[data-testid="weather-storm"]');
await new Promise((resolve) => setTimeout(resolve, 700));
await page.screenshot({ path: path.join(outDir, '03-storm.png') });

await page.click('[data-testid="disconnect-button"]');
await new Promise((resolve) => setTimeout(resolve, 1200));
const offline = await page.evaluate(() => ({
  link: document.querySelector('[data-testid="link-status"]')?.textContent,
  note: document.querySelector('.bottom-note')?.textContent,
}));
await page.click('[data-testid="reconnect-button"]');
await new Promise((resolve) => setTimeout(resolve, 2000));
const relinked = await page.evaluate(() => document.querySelector('[data-testid="link-status"]')?.textContent);

const beforeZoom = await page.evaluate(() => {
  const canvas = document.querySelector('canvas.webgl');
  const rect = canvas.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
});
await page.mouse.move(beforeZoom.x, beforeZoom.y);
await page.mouse.down();
await page.mouse.move(beforeZoom.x + 220, beforeZoom.y + 30, { steps: 14 });
await page.mouse.up();
await page.mouse.wheel({ deltaY: -280 });
await new Promise((resolve) => setTimeout(resolve, 700));
await page.screenshot({ path: path.join(outDir, '04-zoomed.png') });

const diag = await page.evaluate(() => window.__TWIN__?.diag?.());
const samples = [];
for (let i = 0; i < 3; i += 1) {
  samples.push(await page.evaluate(() => window.__TWIN__?.seq));
  await new Promise((resolve) => setTimeout(resolve, 1600));
}

const report = {
  title: first.title,
  canvas: first.canvas,
  initial: { seq: seqA, link: first.link, text: first.seq },
  laterSeq: seqB,
  seqAdvanced: typeof seqA === 'number' && typeof seqB === 'number' && seqB > seqA,
  flowBeforeLoad: flowA,
  flowAt20: lowLoad,
  flowAt95: highLoad?.assets?.['P-401']?.flow?.value,
  loadChangedFlow: typeof lowLoad === 'number' && typeof highLoad?.assets?.['P-401']?.flow?.value === 'number' && highLoad.assets['P-401'].flow.value > lowLoad,
  faulted,
  recovered,
  pause: { pausedA, pausedB },
  offline,
  relinked,
  samples,
  diag,
  consoleErrors: consoleLog.filter((item) => item.type === 'error' || /error|Error|shader/i.test(item.text)),
  pageErrors,
  failed,
};
writeFileSync(path.join(outDir, 'e2e-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
