/**
 * Визуальная проверка игры в headless Chrome.
 *
 * Запускает Chrome с удалённой отладкой, открывает игру и снимает несколько
 * экранов: инструкция, выбор героя, лес, пауза, помощь, телефон и портрет.
 * Нужен только для разработки, на сайт не попадает.
 *
 * Запуск:  node tools/render-check.mjs
 * Требуется установленный Chrome (путь можно задать в CHROME_PATH).
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'предпросмотр');
const PORT = 9333;
const URL = 'http://127.0.0.1:8090/';

const CHROME =
  process.env.CHROME_PATH ||
  (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');

const profile = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'dsh-render-'));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForChrome() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return;
    } catch {
      /* Chrome ещё поднимается */
    }
    await sleep(150);
  }
  throw new Error('Chrome не запустился');
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.waiting = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.waiting.has(msg.id)) {
        const { resolve, reject } = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function openPage(width, height, touch) {
  const target = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
  ).json();
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: touch ? 2 : 1,
    mobile: !!touch,
  });
  if (touch) {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
  await cdp.send('Page.navigate', { url: URL + (touch ? '?touch=1' : '') });
  await sleep(900);
  return cdp;
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Ошибка выполнения');
  }
  return result.result?.value;
}

async function shot(cdp, name) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, Buffer.from(result.data, 'base64'));
  console.log('  ' + path.relative(ROOT, file));
}

fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-crash-reporter',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--window-size=1200,750',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

try {
  await waitForChrome();
  console.log('Снимаю экраны…');

  const desktop = await openPage(1200, 750, false);
  await shot(desktop, 'как-играть.png');

  await evaluate(desktop, 'goToSelect()');
  await sleep(250);
  await shot(desktop, 'выбор-героя.png');

  await evaluate(
    desktop,
    "setInputMode('keyboard'); startGame(); addItem('stick',3); addItem('leaf',4); addItem('bow'); addItem('arrow',5); addItem('apple',2);"
  );
  await sleep(300);
  await shot(desktop, 'лес.png');

  await evaluate(desktop, 'openMenu()');
  await sleep(200);
  await shot(desktop, 'пауза.png');

  await evaluate(desktop, 'closeMenu(); openHelp()');
  await sleep(200);
  await shot(desktop, 'помощь.png');

  await evaluate(desktop, 'closeHelp()');
  desktop.close();

  const touch = await openPage(844, 390, true);
  await shot(touch, 'телефон-инструкция.png');

  await evaluate(
    touch,
    "startGame(); setInputMode('touch'); addItem('stick',3); addItem('leaf',4); addItem('bow'); addItem('arrow',5); addItem('apple',2);"
  );
  await sleep(300);
  await shot(touch, 'телефон-лес.png');
  touch.close();

  const portrait = await openPage(390, 844, true);
  await shot(portrait, 'телефон-поверни.png');
  portrait.close();
} finally {
  chrome.kill();
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {
    /* профиль может быть ещё занят */
  }
}
