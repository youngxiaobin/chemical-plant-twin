import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const outDir = path.resolve(process.env.E2E_OUT_DIR ?? 'evidence');
mkdirSync(outDir, { recursive: true });
const report = {
  passed: false,
  stage: '启动 Chrome',
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failed: [],
  expectedCancellations: [],
};
let browser;
let page;
let browserEvents;
try {
  const port = Number(process.env.PORT ?? 4317);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535, 'PORT 必须是有效端口');
  const baseUrl = new URL(`http://127.0.0.1:${port}`);
  browser = await puppeteer.launch({
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
  page = await browser.newPage();
  page.setDefaultTimeout(15000);
  browserEvents = observeBrowser(page, new URL('/api/stream', baseUrl).href);
  await runScenario(page, baseUrl, browserEvents.expectDisconnect);
  report.stage = '检查浏览器错误';
  assert.equal(report.pageErrors.length, 0, '页面出现未处理异常');
  assert.equal(report.consoleErrors.length, 0, '浏览器控制台出现错误');
  assert.equal(report.failed.length, 0, '浏览器存在非预期请求错误');
  report.stage = '完成';
  report.passed = true;
} catch (error) {
  report.error = { message: String(error), stack: error instanceof Error ? error.stack : undefined };
  process.exitCode = 1;
  if (page) {
    try {
      await page.screenshot({ path: path.join(outDir, 'failure.png') });
    } catch (captureError) {
      report.screenshotError = String(captureError);
    }
  }
} finally {
  browserEvents?.stop();
  try {
    await browser?.close();
  } catch (error) {
    report.closeError = String(error);
    report.passed = false;
    process.exitCode = 1;
  }
  writeFileSync(path.join(outDir, 'e2e-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function runScenario(page, baseUrl, expectDisconnect) {
  report.stage = '重置隔离模拟器';
  const reset = await fetch(new URL('/api/control', baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reset: true }),
    signal: AbortSignal.timeout(10000),
  });
  assert.ok(reset.ok, `重置模拟器失败，HTTP ${reset.status}`);
  await reset.body?.cancel();

  report.stage = '等待场景和首帧遥测';
  await page.goto(baseUrl.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const twin = window.__TWIN__;
    const canvas = document.querySelector('canvas.webgl');
    return Number.isInteger(twin?.seq) && twin.link === 'live' && twin.diag?.()?.draws > 0 && canvas?.width > 0 && canvas.height > 0;
  }, { timeout: 30000 });
  const first = await page.evaluate(() => {
    const canvas = document.querySelector('canvas.webgl');
    return {
      title: document.title,
      seq: window.__TWIN__.seq,
      text: document.querySelector('[data-testid="sample-seq"]')?.textContent,
      link: document.querySelector('[data-testid="link-status"]')?.textContent,
      canvas: { width: canvas.width, height: canvas.height },
    };
  });
  report.title = first.title;
  report.canvas = first.canvas;
  report.initial = { seq: first.seq, link: first.link, text: first.text };
  await page.screenshot({ path: path.join(outDir, '01-overview-rain.png') });
  await page.click('[data-testid="asset-T-101"]');
  await clickButton(page, '定位');
  await page.screenshot({ path: path.join(outDir, '05-close-tower.png') });
  await clickButton(page, '运行总览');
  await page.waitForSelector('[data-testid="view-home"]');
  await page.click('[data-testid="view-home"]');

  report.stage = '验证采样推进';
  await page.waitForFunction((previous) => window.__TWIN__?.seq > previous, {}, first.seq);
  const mid = await page.evaluate(() => window.__TWIN__);
  report.laterSeq = mid.seq;
  report.seqAdvanced = mid.seq > first.seq;
  assert.ok(report.seqAdvanced, '采样序号没有推进');
  report.flowBeforeLoad = mid.frame?.assets?.['P-401']?.flow?.value;

  await page.click('[data-testid="asset-T-101"]');
  report.stage = '验证低负荷遥测';
  report.flowAt20 = await setLoad(page, 20);
  report.stage = '验证高负荷遥测';
  report.flowAt95 = await setLoad(page, 95);
  report.loadChangedFlow = Number.isFinite(report.flowAt20) && Number.isFinite(report.flowAt95) && report.flowAt95 > report.flowAt20;
  assert.ok(report.loadChangedFlow, '进料流量没有随负荷升高');

  await setLoad(page, 78);
  await page.click('[data-testid="asset-T-102"]');
  report.stage = '验证三台设备进入故障告警';
  await clickButton(page, '故障演练');
  report.faulted = await waitForFaultState(page, 'cooling', 'alarm');
  report.faulted.name = await page.$eval('[data-testid="bottom-name"]', (element) => element.textContent);
  assert.match(report.faulted.name, /T-102/, '选中的设备未同步到状态栏');
  await page.screenshot({ path: path.join(outDir, '02-selected-T-102.png') });

  report.stage = '验证故障恢复';
  await clickButton(page, '恢复');
  report.recovered = await waitForFaultState(page, 'none', 'normal');
  assert.ok(report.recovered.stress < report.faulted.stress, '恢复后模拟应力未回落');

  report.stage = '验证暂停心跳和继续采样';
  await clickButton(page, '运行总览');
  await page.click('[data-testid="pause-button"]');
  await page.waitForFunction(() => window.__TWIN__?.frame?.paused === true);
  const paused = await page.evaluate(() => window.__TWIN__.frame);
  await page.waitForFunction((previous) => window.__TWIN__?.frame?.timestamp !== previous, {}, paused.timestamp);
  const heartbeat = await page.evaluate(() => window.__TWIN__.frame);
  report.pause = { pausedA: paused.seq, pausedB: { seq: heartbeat.seq, paused: heartbeat.paused } };
  assert.equal(heartbeat.paused, true, '暂停期间收到未暂停的采样');
  assert.equal(heartbeat.seq, paused.seq, '暂停期间采样序号发生变化');
  await page.click('[data-testid="pause-button"]');
  await page.waitForFunction((previous) => {
    const frame = window.__TWIN__?.frame;
    return frame?.paused === false && frame.seq > previous;
  }, {}, paused.seq);
  report.pause.resumedSeq = await page.evaluate(() => window.__TWIN__.seq);

  report.stage = '切换暴雨并采集画面';
  await page.click('[data-testid="open-weather"]');
  await page.click('[data-testid="weather-storm"]');
  await page.waitForSelector('[data-testid="weather-storm"].active');
  await page.screenshot({ path: path.join(outDir, '03-storm.png') });

  report.stage = '验证手动断开';
  expectDisconnect();
  await page.click('[data-testid="disconnect-button"]');
  await page.waitForFunction(() => window.__TWIN__?.link === 'offline');
  report.offline = await page.evaluate(() => ({
    link: document.querySelector('[data-testid="link-status"]')?.textContent,
    seq: window.__TWIN__.seq,
    note: document.querySelector('.bottom-note')?.textContent,
  }));
  assert.match(report.offline.note, /最后已知采样/, '断开后页面未提示读数为最后已知采样');

  report.stage = '验证重连收到新样本';
  await page.click('[data-testid="reconnect-button"]');
  await page.waitForFunction((previous) => {
    const twin = window.__TWIN__;
    return twin?.link === 'live' && twin.seq > previous;
  }, {}, report.offline.seq);
  report.relinked = await page.$eval('[data-testid="link-status"]', (element) => element.textContent);
  report.samples = [first.seq, mid.seq, await page.evaluate(() => window.__TWIN__.seq)];

  report.stage = '采集操作后的场景';
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
  await page.screenshot({ path: path.join(outDir, '04-zoomed.png') });
  report.diag = await page.evaluate(() => window.__TWIN__?.diag?.());
  assert.ok(report.diag?.draws > 0, '操作后场景未继续绘制');
}

async function clickButton(page, label) {
  await page.evaluate((text) => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent === text);
    if (!button) throw new Error(`未找到按钮：${text}`);
    button.click();
  }, label);
}

async function setLoad(page, percent) {
  await page.$eval('[data-testid="detail-load-slider"]', (element, next) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(element, String(next));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, percent);
  await page.waitForFunction((load) => window.__TWIN__?.frame?.load === load, {}, percent / 100);
  return page.evaluate(() => window.__TWIN__?.frame?.assets?.['P-401']?.flow?.value);
}

async function waitForFaultState(page, fault, status) {
  await page.waitForFunction((expectedFault, expectedStatus) => {
    const frame = window.__TWIN__?.frame;
    return frame?.fault === expectedFault && ['T-102', 'CW-301', 'V-301'].every((id) => frame.assets?.[id]?.status === expectedStatus);
  }, { timeout: 25000 }, fault, status);
  return page.evaluate(() => {
    const { fault, stress, assets } = window.__TWIN__.frame;
    return { fault, stress, t102: assets['T-102'], cw: assets['CW-301'].status, drum: assets['V-301'].status };
  });
}

function observeBrowser(page, streamUrl) {
  const activeStreams = new Set();
  const expectedAborts = new Set();
  let recording = true;
  page.on('console', (message) => {
    if (!recording) return;
    const entry = { type: message.type(), text: message.text() };
    if (entry.type === 'error') report.consoleErrors.push(entry);
    if (entry.type === 'warn' || entry.type === 'warning') report.consoleWarnings.push(entry);
  });
  page.on('pageerror', (error) => {
    if (recording) report.pageErrors.push(String(error));
  });
  page.on('request', (request) => {
    if (recording && request.url() === streamUrl) activeStreams.add(request);
  });
  page.on('requestfinished', (request) => {
    activeStreams.delete(request);
    expectedAborts.delete(request);
  });
  page.on('requestfailed', (request) => {
    if (!recording) return;
    activeStreams.delete(request);
    const expected = expectedAborts.delete(request) && request.failure()?.errorText === 'net::ERR_ABORTED';
    const details = `${request.url()} ${request.failure()?.errorText ?? ''}`;
    (expected ? report.expectedCancellations : report.failed).push(details);
  });
  page.on('response', (response) => {
    if (recording && response.status() >= 400) report.failed.push(`${response.status()} ${response.url()}`);
  });
  return {
    expectDisconnect() {
      for (const request of activeStreams) expectedAborts.add(request);
    },
    stop() {
      recording = false;
    },
  };
}
