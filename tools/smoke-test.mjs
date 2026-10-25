/**
 * Смоук-тест игры «Жизнь в лесу».
 *
 * Запускает game.js в Node внутри песочницы с заглушками canvas / document /
 * window / localStorage и прогоняет основные экраны игры. Нужен, чтобы поймать
 * синтаксические и runtime-ошибки до деплоя.
 *
 * Запуск:  node tools/smoke-test.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const GAME = path.join(ROOT, 'game.js');
const VIEW_W = 960;
const VIEW_H = 600;

const failures = [];
const checks = [];
function check(name, cond, extra = '') {
  checks.push({ name, ok: !!cond, extra });
  if (!cond) failures.push(`${name}${extra ? ' — ' + extra : ''}`);
}

/* ----------------------------- заглушка canvas ----------------------------- */

function makeCtx() {
  const props = {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashOffset: 0,
    font: '10px monospace',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    shadowBlur: 0,
    shadowColor: 'transparent',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
  };
  const calls = { total: 0, frames: 0, unknown: new Set() };
  const gradient = () => ({ addColorStop() {} });

  const impl = {
    measureText: (t) => ({ width: String(t).length * 7 }),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({
      data: new Uint8ClampedArray(Math.max(4, Math.abs(w * h) * 4)),
      width: w,
      height: h,
    }),
    isPointInPath: () => false,
    getLineDash: () => [],
  };

  return new Proxy(
    { __calls: calls },
    {
      get(t, prop) {
        if (prop === '__calls') return calls;
        if (prop in impl) return impl[prop];
        if (prop in props) return props[prop];
        if (typeof prop === 'symbol') return undefined;
        if (prop === 'canvas') return { width: VIEW_W, height: VIEW_H };
        // любое незнакомое свойство считаем графическим методом
        calls.unknown.add(prop);
        return function stub() {
          calls.total++;
        };
      },
      set(t, prop, value) {
        props[prop] = value;
        return true;
      },
      has() {
        return true;
      },
    }
  );
}

/* --------------------------- песочница браузера ---------------------------- */

function makeSandbox({ storage: sharedStorage } = {}) {
  const clock = { t: 1000 };
  const rafQueue = [];
  const listeners = { window: new Map(), canvas: new Map() };
  const storage = sharedStorage || new Map();
  const logs = [];

  const ctx = makeCtx();
  const calls = ctx.__calls;

  const canvas = {
    width: VIEW_W,
    height: VIEW_H,
    style: {},
    getContext: () => ctx,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      right: VIEW_W,
      bottom: VIEW_H,
      width: VIEW_W,
      height: VIEW_H,
      x: 0,
      y: 0,
    }),
    addEventListener: (type, fn) => {
      if (!listeners.canvas.has(type)) listeners.canvas.set(type, []);
      listeners.canvas.get(type).push(fn);
    },
    removeEventListener: () => {},
    setAttribute: () => {},
    focus: () => {},
  };

  // заглушки DOM-элементов страницы (canvas + служебные блоки из index.html)
  const elements = new Map();
  function element(id) {
    if (id === 'game') return canvas;
    if (!elements.has(id)) elements.set(id, { id, hidden: true, style: {}, textContent: '' });
    return elements.get(id);
  }

  const windowObj = {
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 1,
    addEventListener: (type, fn) => {
      if (!listeners.window.has(type)) listeners.window.set(type, []);
      listeners.window.get(type).push(fn);
    },
    removeEventListener: () => {},
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
      clear: () => storage.clear(),
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  };

  const sandbox = {
    window: windowObj,
    self: windowObj,
    document: {
      getElementById: (id) => element(id),
      querySelector: () => null,
      addEventListener: () => {},
      body: { appendChild() {}, style: {} },
      documentElement: { style: {} },
    },
    canvas,
    performance: { now: () => clock.t, timeOrigin: 0 },
    requestAnimationFrame: (cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    },
    cancelAnimationFrame: () => {},
    console: {
      log: (...a) => logs.push(['log', a.map(String).join(' ')]),
      warn: (...a) => logs.push(['warn', a.map(String).join(' ')]),
      error: (...a) => logs.push(['error', a.map(String).join(' ')]),
      info: () => {},
      debug: () => {},
    },
    localStorage: windowObj.localStorage,
    navigator: { userAgent: 'smoke-test', language: 'ru-RU' },
    addEventListener: windowObj.addEventListener,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
  };

  const context = vm.createContext(sandbox);
  const run = (expr) => vm.runInContext(expr, context, { timeout: 20000 });

  function dispatchWindow(type, event) {
    for (const fn of listeners.window.get(type) || []) {
      fn({ preventDefault() {}, stopPropagation() {}, ...event });
    }
  }
  function key(code, down = true) {
    dispatchWindow(down ? 'keydown' : 'keyup', { code, key: code });
  }
  function click(x, y) {
    for (const fn of listeners.canvas.get('mousemove') || []) fn({ clientX: x, clientY: y });
    for (const fn of listeners.canvas.get('click') || []) fn({ clientX: x, clientY: y });
  }
  /** Прокрутить n кадров по 16.67 мс. */
  function frames(n) {
    for (let i = 0; i < n; i++) {
      const queued = rafQueue.splice(0, rafQueue.length);
      clock.t += 1000 / 60;
      if (!queued.length) throw new Error('игра не запросила новый кадр (rAF)');
      calls.frames++;
      for (const cb of queued) cb(clock.t);
    }
  }
  function tryFrames(n, label) {
    try {
      frames(n);
      return true;
    } catch (err) {
      check(`кадры: ${label}`, false, err.message);
      return false;
    }
  }

  return { sandbox, context, run, key, click, frames, tryFrames, storage, logs, calls, clock, elements };
}

/* --------------------------------- загрузка -------------------------------- */

let code;
try {
  code = fs.readFileSync(GAME, 'utf8');
} catch (err) {
  console.error('Не найден game.js:', err.message);
  process.exit(1);
}

console.log('Смоук-тест game.js\n');

check('game.js в UTF-8 без BOM', !code.startsWith('\uFEFF'));
check('в game.js нет mojibake (Ð/Ñ)', !/[ÐÑ][\u0080-\u00BF]/.test(code));
check('game.js содержит русский текст', /ЖИЗНЬ В ЛЕСУ|Выбери персонажа/.test(code));

const g = makeSandbox();
let loadError = null;
try {
  vm.runInContext(code, g.context, { filename: 'game.js', timeout: 20000 });
} catch (err) {
  loadError = err;
}
check(
  'game.js загружается без ошибок',
  !loadError,
  loadError?.stack?.split('\n').slice(0, 2).join(' | ')
);

if (loadError) {
  report();
  process.exit(1);
}

const state = () => {
  try {
    return g.run('state');
  } catch {
    return '<нет state>';
  }
};

/* ---------------------------- экран выбора -------------------------------- */

check('стартовый экран — выбор персонажа', state() === 'select', String(state()));
g.tryFrames(20, 'выбор персонажа');

const cardX = g.run('cardRect(2).x + cardRect(2).w / 2');
const cardY = g.run('cardRect(2).y + 100');
g.click(cardX, cardY);
g.tryFrames(1, 'клик по карточке');
const eyeX = g.run('swatchRect(1).x + swatchRect(1).w / 2');
const eyeY = g.run('swatchRect(1).y + swatchRect(1).h / 2');
g.click(eyeX, eyeY);
g.tryFrames(3, 'клик по цвету глаз');
check('клик по карточке выбирает персонажа', g.run('selChar') === 2, 'selChar=' + g.run('selChar'));
check('клик по цвету выбирает глаза', g.run('selEye') === 1, 'selEye=' + g.run('selEye'));

/* ---------------------------------- лес ----------------------------------- */

g.key('Enter');
g.key('Enter', false);
check('Enter запускает игру', state() === 'play', String(state()));
check('HP игрока = 50', g.run('player.hp') === 50, 'hp=' + g.run('player.hp'));
check('голод = 100', Math.round(g.run('player.hunger')) === 100, 'hunger=' + g.run('player.hunger'));

const x0 = g.run('player.x');
const y0 = g.run('player.y');
g.key('ArrowRight');
g.key('KeyS');
g.tryFrames(60, 'ходьба');
g.key('ArrowRight', false);
g.key('KeyS', false);
const dx = g.run('player.x') - x0;
const dy = g.run('player.y') - y0;
check('персонаж двигается по карте', Math.abs(dx) > 1 || Math.abs(dy) > 1, `dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);

g.key('KeyF');
g.key('KeyF', false);
g.key('KeyE');
g.key('KeyE', false);
g.key('KeyC');
g.tryFrames(10, 'окно крафта');
check('крафт открывается по C', g.run('craftOpen') === true);
g.key('KeyC', false);
g.key('Escape');
g.tryFrames(5, 'закрытие крафта');
check('крафт закрывается по Esc', g.run('craftOpen') === false);
for (const d of ['Digit1', 'Digit2', 'Digit3']) g.key(d);

// ~40 секунд игры: день сменяется, ночь с волками, готовка, голод
g.tryFrames(2400, 'геймплей 40 сек');
check('день/ночь тикают', g.run('clock.day') >= 1, 'day=' + g.run('clock.day'));
check('голод потихоньку тратится', g.run('player.hunger') < 100, 'hunger=' + g.run('player.hunger').toFixed(1));

/* --------------------------- экран победы над боссом ----------------------- */

try {
  g.run("player.hp = 34; finishBoss('yaga')");
  check('finishBoss открывает экран победы', state() === 'victory', String(state()));
  g.tryFrames(30, 'экран победы');
  check('алмазики начислены за босса', g.run('progress.diamonds') > 0, 'diamonds=' + g.run('progress.diamonds'));
  check('прогресс сохранён в localStorage', g.storage.has('zhizn-v-lesu-progress-v1'));
  g.key('Enter');
  g.key('Enter', false);
  check('с экрана победы можно вернуться в бой', state() === 'play', String(state()));
} catch (err) {
  check('сценарий победы над боссом', false, err.message);
}

/* --------------------------------- поражение ------------------------------ */

try {
  g.run("player.invuln = 0; hurtPlayer(60, 0, -1, 'Тест')");
  check('при 0 HP включается экран поражения', state() === 'faint', String(state()));
  check('причина поражения сохраняется', typeof g.run('faintReason') === 'string');
  g.tryFrames(20, 'экран поражения');
  g.key('Enter');
  g.key('Enter', false);
  check('с экрана поражения можно начать заново', state() === 'play', String(state()));
  check('после рестарта HP снова 50', g.run('player.hp') === 50, 'hp=' + g.run('player.hp'));
} catch (err) {
  check('сценарий поражения', false, err.message);
}

/* ---------------------------------- город --------------------------------- */

try {
  g.run('enterCity()');
  g.tryFrames(90, 'город');
  const npcs = g.run("city.objects.filter((o) => o.type === 'npc').length");
  check('в городе есть NPC', npcs > 0, 'npc=' + npcs);
  g.run("startDialog(city.objects.find((o) => o.type === 'npc'))");
  g.tryFrames(20, 'диалог с NPC');
  check('диалог с NPC открывается', g.run('dialog') !== null);
  g.key('Escape');
  g.tryFrames(5, 'закрытие диалога');
  check('диалог закрывается по Esc', g.run('dialog') === null);
} catch (err) {
  check('сценарий города', false, err.message);
}

/* ---------------------------------- финал --------------------------------- */

try {
  g.run('finishGame()');
  check('финал включает экран «часть 1 пройдена»', state() === 'win', String(state()));
  g.tryFrames(20, 'финальный экран');
  g.key('Enter');
  g.key('Enter', false);
  check('с финала можно вернуться в игру', state() === 'play', String(state()));
} catch (err) {
  check('сценарий финала', false, err.message);
}

/* ------------------------ сохранение после перезагрузки -------------------- */

try {
  g.storage.set(
    'zhizn-v-lesu-progress-v1',
    JSON.stringify({ diamonds: 7, owned: { cap: true }, worn: { cap: true } })
  );
  const g2 = makeSandbox({ storage: g.storage });
  vm.runInContext(code, g2.context, { filename: 'game.js (перезагрузка)', timeout: 20000 });
  check('прогресс читается после перезагрузки', g2.run('progress.diamonds') === 7, 'diamonds=' + g2.run('progress.diamonds'));
  check('купленная одежда восстанавливается', g2.run('progress.owned.cap') === true);
} catch (err) {
  check('сценарий перезагрузки', false, err.message);
}

/* --------------------------- страница index.html -------------------------- */

let html = '';
try {
  html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
} catch {
  /* проверка ниже покажет провал */
}
check('index.html на месте и не пустой', html.length > 200, html.length + ' байт');

if (html) {
  check('на странице указан charset utf-8', /<meta charset="utf-8">/i.test(html));
  check('язык страницы — русский', /<html lang="ru">/i.test(html));
  check('страница подключает game.js', /<script[^>]+src="game\.js"/.test(html));
  check('есть холст 960×600', /<canvas[^>]+width="960"[^>]+height="600"/.test(html));

  const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^(https?:|data:|mailto:|#)/.test(u));
  const missing = refs.filter((u) => !fs.existsSync(path.join(ROOT, u)));
  check('все ссылки страницы ведут на существующие файлы', missing.length === 0, missing.join(', '));
  check('страница ссылается на иконки и скрипт', refs.length >= 4, 'ссылок: ' + refs.length);
  const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || '';
  const ogLocal = ogImage.replace(/^https:\/\/gagalinna\.github\.io\/zhizn-v-lesu\//, '');
  check('og:image — абсолютный адрес', /^https:\/\//.test(ogImage), ogImage);
  check('og:image указывает на существующий файл', !!ogLocal && fs.existsSync(path.join(ROOT, ogLocal)), ogImage);
  check('есть описание для поисковиков', /<meta name="description" content="[^"]{40,}"/.test(html));

  // страховка: если game.js не загрузился, вместо пустого экрана — сообщение
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  check('на странице есть проверка запуска игры', inline.length > 0);
  if (inline.length) {
    const boot = inline[inline.length - 1];
    try {
      vm.runInContext(boot, g.context, { filename: 'index.html (проверка запуска)', timeout: 5000 });
      check('при работающей игре сообщение об ошибке скрыто', g.elements.get('fallback')?.hidden !== false);
    } catch (err) {
      check('проверка запуска на странице не падает', false, err.message);
    }
    try {
      const fresh = makeSandbox();
      vm.runInContext(boot, fresh.context, { filename: 'index.html (без game.js)', timeout: 5000 });
      check('без game.js страница показывает сообщение об ошибке', fresh.elements.get('fallback')?.hidden === false);
    } catch (err) {
      check('проверка запуска работает без game.js', false, err.message);
    }
  }
}

// конфиг хостинга
try {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  check('vercel.json — валидный JSON', cfg && typeof cfg === 'object');
  check('в vercel.json есть заголовки кэширования', Array.isArray(cfg.headers) && cfg.headers.length > 0);
} catch (err) {
  check('vercel.json — валидный JSON', false, err.message);
}

/* ---------------------------------- итог ---------------------------------- */

const totalCalls = g.calls.total;
const totalFrames = g.calls.frames;
check('canvas активно рисует', totalCalls > 20000, 'вызовов: ' + totalCalls);
const jsErrors = g.logs.filter(([lvl]) => lvl === 'error');
check('нет ошибок в консоли', jsErrors.length === 0, jsErrors.slice(0, 3).map((e) => e[1]).join(' | '));

function report() {
  const ok = checks.filter((c) => c.ok).length;
  for (const c of checks) {
    console.log(`${c.ok ? '  ok  ' : ' FAIL '} ${c.name}${c.ok || !c.extra ? '' : ' — ' + c.extra}`);
  }
  console.log('');
  console.log(`Проверок: ${checks.length} · пройдено: ${ok} · провалено: ${checks.length - ok}`);
  console.log(`Кадров: ${totalFrames} · вызовов рисования: ${totalCalls}`);
  if (failures.length) console.log('\nПровалы:\n- ' + failures.join('\n- '));
}

report();
process.exit(failures.length ? 1 : 0);
