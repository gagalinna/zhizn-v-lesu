/* ==========================================================================
   «Жизнь в лесу» — Этапы 1–7
   1) Экран выбора персонажа (4 варианта + цвет глаз) и ходьба по карте леса.
   2) Еда на деревьях и грядках, полоски здоровья и голода.
   3) Инвентарь, сбор ресурсов, крафт (костёр, бомба, кровать),
      смена дня и ночи, сон в кровати.
   4) Бой: лук, волки по ночам, пещеры с летучими мышами, уголь и кристаллы.
   5) Боссы: Баба-яга у избушки (кидает зелья, с ней бывает чёрная кошка,
      после победы открывается её огород с морковью) и Леший у ворот из леса
      (1000 HP, ранить можно только из лука).
   6) Алмазики за победу над боссами, экран победы со звёздами и лицом босса
      с крестиками, лавка одежды (кепка, очки, шарф, шляпа, плащ, корона).
      Прогресс сохраняется в localStorage.
   7) Город Зелёный Бор с жителями и разговорами, возвращение в лес,
      финал первой части и задел на вторую (дорога на восток).
   8) Игра с телефона (джойстик и кнопки), с геймпада (Gamepad API),
      краткая инструкция при запуске, пауза и помощь.
   Графика — простые пиксельные заглушки, рисуются прямоугольниками.
   ========================================================================== */

'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Телефон/планшет определяем по «грубому» указателю. Параметр ?touch=1
// принудительно включает сенсорное управление — удобно для проверки и для
// гибридных устройств, где браузер не признаёт экран сенсорным.
function detectTouch() {
  try {
    if (typeof location !== 'undefined' && /[?&]touch=1(?:[&#]|$)/.test(location.search)) return true;
    if (window.matchMedia) {
      if (window.matchMedia('(any-pointer: coarse)').matches) return true;
      if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return true;
    }
    if (
      'ontouchstart' in window &&
      typeof navigator !== 'undefined' &&
      navigator.maxTouchPoints > 0
    ) {
      return true;
    }
  } catch (e) {
    /* очень старый браузер — считаем, что это компьютер */
  }
  return false;
}
const IS_TOUCH = detectTouch();

// На телефоне широкий экран (19:9, 20:9) — растягиваем внутреннюю картинку,
// чтобы игра занимала весь обзор, а не узкую полоску по центру. Высота всегда
// 600, ширина растёт до 1200 — так пещеры (1200 пикселей) видны целиком.
if (IS_TOUCH) {
  try {
    const a = Math.max(window.innerWidth, window.innerHeight) / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const wide = Math.round(canvas.height * a);
    if (wide > canvas.width) canvas.width = Math.min(1200, wide);
  } catch (e) {
    /* оставляем 960×600 */
  }
}

const VIEW_W = canvas.width;
const VIEW_H = canvas.height;

/* ----------------------------- Персонажи --------------------------------- */

// Спрайт рисуется в сетке 12 x 16 «пикселей».
const SPR_W = 12;
const SPR_H = 16;

const SHOES = '#1b1b22'; // кроссовки чёрные и не меняются (см. дизайн-документ)

const CHARACTERS = [
  {
    name: 'Брюнетка',
    desc: ['прямые волосы', 'зелёная кофточка', 'синие штаны'],
    hair: '#3b2415',
    hairStyle: 'long',
    skin: '#f0c39a',
    shirt: '#3fa04a',
    shirtDark: '#2f7a38',
    pants: '#3a5bbf',
  },
  {
    name: 'Блондинка',
    desc: ['кудрявые волосы', 'розовая майка', 'джинсы'],
    hair: '#e8c85a',
    hairStyle: 'curly',
    skin: '#f6d0ac',
    shirt: '#f07fb0',
    shirtDark: '#c85f8d',
    pants: '#4a6fb5',
  },
  {
    name: 'Мальчик тёмненький',
    desc: ['синяя кофта', 'чёрные штаны'],
    hair: '#241710',
    hairStyle: 'short',
    skin: '#c98d5f',
    shirt: '#2f5bb7',
    shirtDark: '#24468c',
    pants: '#26262f',
  },
  {
    name: 'Мальчик блондин',
    desc: ['красная футболка', 'джинсы'],
    hair: '#f0d878',
    hairStyle: 'short',
    skin: '#f2c79c',
    shirt: '#d13b3b',
    shirtDark: '#a52c2c',
    pants: '#4a6fb5',
  },
];

const EYE_COLORS = [
  { name: 'синий', color: '#2f6fd0' },
  { name: 'зелёный', color: '#2f9e4f' },
  { name: 'красный', color: '#cc2b2b' },
  { name: 'оранжевый', color: '#e88a1e' },
  { name: 'чёрный', color: '#1a1a1a' },
];

/* --------------------------------- Еда ----------------------------------- */

const MAX_HP = 50;
const MAX_HUNGER = 100;

// Сколько голода восполняет еда и как быстро она вырастает снова.
const FOOD = {
  appleTree: { food: 'яблоко', item: 'apple', hunger: 12, max: 3, regrow: 20 },
  bananaTree: { food: 'банан', item: 'banana', hunger: 15, max: 3, regrow: 24 },
  vegetable: { food: 'овощ', item: 'veg', hunger: 8, max: 2, regrow: 16 },
  // морковь растёт только на огороде Бабы-яги — он открывается после победы над ней
  carrotPatch: { food: 'морковь', item: 'carrot', hunger: 10, max: 4, regrow: 18 },
};

// Виды овощей на грядках — отличаются только видом и названием.
const VEGGIES = [
  { name: 'капуста', body: '#8bc34a', dark: '#5f9134' },
  { name: 'репка', body: '#f0e2a8', dark: '#cbb977' },
  { name: 'свёкла', body: '#a13a72', dark: '#742450' },
];

/* ------------------------- Ресурсы для крафта ----------------------------- */

const LEAF_MAX = 3; // сколько листьев можно набрать с одного куста
const COAL_MAX = 3; // сколько угля даёт один камень
const LEAF_REGROW = 30;
const STICK_REGROW = 45;
const COAL_REGROW = 60;
const MATCH_REGROW = 90;

/* ------------------------------ Предметы --------------------------------- */

// Всё, что помещается в инвентарь. hunger — сколько восполняет, если съесть.
const ITEMS = {
  apple: { name: 'Яблоко', hunger: 12 },
  banana: { name: 'Банан', hunger: 15 },
  veg: { name: 'Овощ', hunger: 8 },
  stick: { name: 'Палка' },
  coal: { name: 'Уголь' },
  match: { name: 'Спичка' },
  leaf: { name: 'Листья' },
  campfire: { name: 'Костёр', place: true },
  bed: { name: 'Кровать', place: true },
  bomb: { name: 'Бомба', throwable: true },
  bow: { name: 'Лук' },
  arrow: { name: 'Стрела' },
  meat: { name: 'Сырое мясо', hunger: 4 },
  cookedMeat: { name: 'Жареное мясо', hunger: 30 },
  crystal: { name: 'Кристалл' },
  crystalBow: { name: 'Кристальный лук' },
  carrot: { name: 'Морковь', hunger: 10 },
  pie: { name: 'Пирожок', hunger: 35 },
  potionBlue: { name: 'Синее зелье', heal: 25 },
  potionGreen: { name: 'Зелёное зелье', poison: 8 },
};

// Рецепты крафта. need — что потратить, out — что получится (n — сколько штук).
const RECIPES = [
  { out: 'campfire', need: { stick: 2, coal: 1 }, note: 'светит и греет ночью' },
  { out: 'bomb', need: { match: 1, apple: 1 }, note: 'бросить во врагов' },
  { out: 'bed', need: { stick: 3, leaf: 4 }, note: 'поставь и спи ночью' },
  { out: 'bow', need: { stick: 2, leaf: 2 }, note: 'главное оружие' },
  { out: 'arrow', n: 3, need: { stick: 1, leaf: 1 }, note: 'нужны для стрельбы' },
  { out: 'crystalBow', need: { bow: 1, crystal: 3 }, note: 'бьёт вдвое сильнее — против Лешего' },
];

const INV_SLOTS = 10;
const inventory = []; // [{ id, count }] — по одному стеку на вид предмета

function invCount(id) {
  const s = inventory.find((it) => it.id === id);
  return s ? s.count : 0;
}

// Лук бывает простой и кристальный — второй бьёт вдвое сильнее.
function hasBow() {
  return invCount('bow') > 0 || invCount('crystalBow') > 0;
}

function hasCrystalBow() {
  return invCount('crystalBow') > 0;
}

/* ------------------- Алмазики, одежда и прогресс ------------------------- */

// Одежда продаётся в лавке за алмазики. slot — что именно надевается:
// шапка, очки, шарф или плащ (одна вещь на слот).
const CLOTHES = [
  { id: 'cap', name: 'Красная кепка', price: 2, slot: 'hat', note: 'козырёк от солнца' },
  { id: 'glasses', name: 'Круглые очки', price: 2, slot: 'face', note: 'умный вид' },
  { id: 'scarf', name: 'Тёплый шарф', price: 3, slot: 'neck', note: 'вяжется к холодам' },
  { id: 'strawHat', name: 'Соломенная шляпа', price: 4, slot: 'hat', note: 'для прогулок по лесу' },
  { id: 'cape', name: 'Лесной плащ', price: 6, slot: 'body', note: 'как у путешественника' },
  { id: 'crown', name: 'Корона', price: 8, slot: 'hat', note: 'для настоящих героев' },
];

// Прогресс между забегами: алмазики и купленная одежда.
const progress = { diamonds: 0, owned: {}, worn: {} };
const PROGRESS_KEY = 'zhizn-v-lesu-progress-v1';

function loadProgress() {
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    progress.diamonds = Math.max(0, Number(data.diamonds) || 0);
    progress.owned = data.owned && typeof data.owned === 'object' ? data.owned : {};
    progress.worn = data.worn && typeof data.worn === 'object' ? data.worn : {};
  } catch (e) {
    // без сохранения игра тоже работает — просто прогресс не запомнится
  }
}

function saveProgress() {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    /* приватный режим или запрет хранилища — не страшно */
  }
}

function addDiamonds(n) {
  progress.diamonds = Math.max(0, progress.diamonds + n);
  saveProgress();
}

function clothesById(id) {
  return CLOTHES.find((c) => c.id === id) || null;
}

// Купить вещь или надеть/снять уже купленную.
function shopClick(item) {
  if (progress.owned[item.id]) {
    if (progress.worn[item.id]) {
      progress.worn[item.id] = false;
      say(item.name + ' снята', '#cfe3d2');
    } else {
      // на один слот — одна вещь
      for (const other of CLOTHES) {
        if (other.slot === item.slot) progress.worn[other.id] = false;
      }
      progress.worn[item.id] = true;
      say('Надето: ' + item.name, '#a6e07a');
    }
    saveProgress();
    return;
  }
  if (progress.diamonds < item.price) {
    say('Не хватает алмазиков — победи босса', '#ff9a8a');
    return;
  }
  progress.diamonds -= item.price;
  progress.owned[item.id] = true;
  for (const other of CLOTHES) {
    if (other.slot === item.slot) progress.worn[other.id] = false;
  }
  progress.worn[item.id] = true;
  saveProgress();
  say('Куплено: ' + item.name + ' (−' + item.price + ' ♦)', '#8fd6ff');
}


// Кладём предмет в инвентарь. Вернёт false, если места нет.
function addItem(id, n = 1) {
  const s = inventory.find((it) => it.id === id);
  if (s) {
    s.count += n;
    return true;
  }
  if (inventory.length >= INV_SLOTS) return false;
  inventory.push({ id, count: n });
  return true;
}

function removeItem(id, n = 1) {
  const i = inventory.findIndex((it) => it.id === id);
  if (i < 0 || inventory[i].count < n) return false;
  inventory[i].count -= n;
  if (inventory[i].count <= 0) inventory.splice(i, 1);
  return true;
}

function canCraft(recipe) {
  return Object.entries(recipe.need).every(([id, n]) => invCount(id) >= n);
}

function craft(recipe) {
  if (!canCraft(recipe)) {
    say('Не хватает материалов', '#ff9a8a');
    return;
  }
  // предмет должен куда-то поместиться
  if (invCount(recipe.out) === 0 && inventory.length >= INV_SLOTS) {
    say('Инвентарь полон', '#ff9a8a');
    return;
  }
  for (const [id, n] of Object.entries(recipe.need)) removeItem(id, n);
  const n = recipe.n || 1;
  addItem(recipe.out, n);
  say('Скрафчено: ' + ITEMS[recipe.out].name + (n > 1 ? ' x' + n : ''), '#a6e07a');
}

/* --------------------------- Иконки предметов ----------------------------- */

// Все иконки рисуются в сетке 16 x 16 и масштабируются под размер клетки.
function drawItemIcon(g, id, x, y, size) {
  const s = size / 16;
  const px = (ix, iy, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x + ix * s, y + iy * s, w * s, h * s);
  };
  switch (id) {
    case 'apple':
      px(7, 2, 2, 2, '#3f7a35');
      px(4, 4, 8, 9, '#cc2f2a');
      px(3, 6, 1, 5, '#cc2f2a');
      px(12, 6, 1, 5, '#cc2f2a');
      px(5, 6, 2, 3, '#ee6a5c');
      break;
    case 'banana':
      px(5, 3, 3, 2, '#6d5230');
      px(4, 5, 3, 6, '#f0cd33');
      px(5, 10, 5, 3, '#f0cd33');
      px(9, 8, 3, 4, '#f0cd33');
      px(5, 6, 1, 4, '#fbe98a');
      px(8, 12, 4, 1, '#d0a41c');
      break;
    case 'veg':
      px(5, 2, 2, 4, '#3f8f45');
      px(8, 2, 2, 4, '#3f8f45');
      px(3, 6, 10, 7, '#8bc34a');
      px(3, 11, 10, 2, '#5f9134');
      px(5, 7, 2, 2, 'rgba(255,255,255,0.5)');
      break;
    case 'stick':
      px(3, 11, 10, 2, '#8a6234');
      px(5, 9, 6, 2, '#8a6234');
      px(11, 8, 2, 2, '#6b4a26');
      px(4, 13, 8, 1, '#6b4a26');
      break;
    case 'coal':
      px(4, 6, 8, 7, '#3a3a42');
      px(3, 8, 2, 4, '#2b2b32');
      px(11, 7, 2, 4, '#2b2b32');
      px(6, 8, 3, 2, '#5c5c68');
      break;
    case 'match':
      px(7, 5, 2, 9, '#d8bb85');
      px(6, 2, 4, 4, '#cc2f2a');
      px(7, 3, 1, 2, '#ffb060');
      break;
    case 'leaf':
      px(5, 4, 6, 3, '#4fa054');
      px(3, 6, 10, 4, '#3f8f45');
      px(5, 10, 6, 2, '#357a3d');
      px(7, 4, 2, 8, 'rgba(20,60,26,0.5)');
      break;
    case 'campfire':
      px(2, 11, 12, 2, '#6b4a26');
      px(3, 9, 10, 2, '#8a6234');
      px(6, 5, 4, 6, '#f0851e');
      px(5, 7, 6, 4, '#f0851e');
      px(7, 7, 2, 4, '#ffd45c');
      px(6, 3, 2, 3, '#e85a1e');
      break;
    case 'bed':
      px(2, 6, 12, 6, '#8a6234');
      px(2, 12, 2, 2, '#6b4a26');
      px(12, 12, 2, 2, '#6b4a26');
      px(3, 7, 4, 4, '#f2ead6');
      px(7, 7, 6, 4, '#c8465f');
      px(7, 9, 6, 2, '#a5344b');
      break;
    case 'bomb':
      px(4, 6, 8, 8, '#22222a');
      px(3, 8, 10, 5, '#22222a');
      px(5, 8, 2, 2, '#5c5c68');
      px(7, 3, 2, 3, '#8a6234');
      px(9, 2, 2, 2, '#ffd45c');
      break;
    case 'bow':
      px(4, 2, 3, 2, '#8a6234');
      px(3, 4, 2, 8, '#8a6234');
      px(4, 12, 3, 2, '#8a6234');
      px(6, 3, 1, 10, '#e8e0cf'); // тетива
      px(6, 7, 8, 2, '#d8bb85'); // стрела на тетиве
      px(12, 6, 3, 4, '#b0b6c0');
      break;
    case 'arrow':
      px(3, 11, 9, 2, '#d8bb85');
      px(11, 9, 4, 6, '#b0b6c0');
      px(2, 9, 3, 2, '#e8e0cf');
      px(2, 13, 3, 2, '#e8e0cf');
      break;
    case 'meat':
      px(4, 5, 9, 8, '#d05a5a');
      px(5, 6, 4, 3, '#e88b8b');
      px(4, 11, 9, 2, '#a83f47');
      px(11, 3, 3, 4, '#f2ead6'); // косточка
      px(12, 2, 3, 2, '#f2ead6');
      break;
    case 'cookedMeat':
      px(4, 5, 9, 8, '#9b5a2c');
      px(5, 6, 4, 3, '#c07a40');
      px(4, 11, 9, 2, '#6d3c1c');
      px(6, 7, 5, 1, '#4a2611');
      px(11, 3, 3, 4, '#f2ead6');
      px(12, 2, 3, 2, '#f2ead6');
      break;
    case 'crystal':
      px(7, 1, 3, 3, '#d9a6f5');
      px(5, 4, 7, 7, '#a45de0');
      px(6, 11, 5, 3, '#7a3cb8');
      px(6, 4, 2, 6, '#e0bcff');
      px(10, 6, 1, 4, '#7a3cb8');
      break;
    case 'crystalBow':
      px(4, 2, 3, 2, '#8a6234');
      px(3, 4, 2, 8, '#8a6234');
      px(4, 12, 3, 2, '#8a6234');
      px(6, 3, 1, 10, '#e8e0cf'); // тетива
      px(6, 7, 8, 2, '#d8bb85'); // стрела
      px(12, 5, 3, 5, '#a45de0'); // кристальный наконечник
      px(13, 6, 1, 3, '#e0bcff');
      break;
    case 'carrot':
      px(5, 1, 2, 3, '#3f8f45');
      px(8, 2, 2, 3, '#4fa054');
      px(9, 1, 2, 2, '#3f8f45');
      px(5, 4, 6, 3, '#e8822a');
      px(6, 7, 4, 3, '#d06818');
      px(7, 10, 2, 3, '#b85712');
      px(6, 5, 2, 2, '#ffb060');
      break;
    case 'pie':
      px(2, 6, 12, 6, '#d9a04a');
      px(3, 5, 10, 2, '#e8b45a');
      px(2, 11, 12, 2, '#a8742c');
      px(5, 7, 2, 1, '#f5d98a');
      px(8, 8, 2, 1, '#f5d98a');
      px(10, 6, 1, 1, '#f5d98a');
      px(6, 2, 1, 2, 'rgba(255,255,255,0.5)');
      px(9, 1, 1, 3, 'rgba(255,255,255,0.4)');
      break;
    case 'potionBlue':
    case 'potionGreen': {
      const liquid = id === 'potionBlue' ? '#3f7fd0' : '#4fa054';
      const shine = id === 'potionBlue' ? '#7fb8ff' : '#8fd07a';
      px(6, 1, 4, 2, '#8a6234'); // пробка
      px(6, 3, 4, 3, '#cfe3d2'); // горлышко
      px(4, 6, 8, 7, '#cfe3d2'); // колба
      px(5, 8, 6, 4, liquid); // зелье
      px(6, 9, 2, 2, shine);
      px(11, 9, 1, 3, '#9dbfa4');
      break;
    }
    case 'diamond':
      px(7, 1, 3, 2, '#d9fbff');
      px(4, 3, 9, 4, '#7ae0ff');
      px(6, 7, 5, 4, '#3fb8e0');
      px(7, 11, 3, 3, '#2a8fbf');
      px(5, 4, 2, 2, '#e6ffff');
      px(11, 4, 1, 2, '#bff0ff');
      break;
    case 'cap':
      px(4, 3, 8, 4, '#c0392b');
      px(3, 2, 8, 2, '#a52c2c');
      px(2, 7, 12, 3, '#a52c2c');
      px(8, 2, 2, 2, '#e04a3a');
      break;
    case 'strawHat':
      px(5, 1, 6, 4, '#e8c85a');
      px(5, 4, 6, 2, '#a5822c');
      px(2, 6, 12, 3, '#d9b45a');
      px(2, 8, 12, 1, '#a5822c');
      break;
    case 'crown':
      px(4, 7, 8, 6, '#f0c840');
      px(4, 3, 2, 4, '#f0c840');
      px(7, 1, 2, 6, '#f0c840');
      px(10, 3, 2, 4, '#f0c840');
      px(5, 9, 1, 2, '#c0392b');
      px(8, 9, 1, 2, '#3f7fd0');
      px(11, 9, 1, 2, '#c0392b');
      break;
    case 'glasses':
      px(2, 5, 5, 4, '#2b2b33');
      px(9, 5, 5, 4, '#2b2b33');
      px(6, 6, 3, 2, '#2b2b33');
      px(3, 6, 3, 2, '#9ad0f5');
      px(10, 6, 3, 2, '#9ad0f5');
      break;
    case 'scarf':
      px(2, 3, 12, 4, '#c94a4a');
      px(2, 6, 12, 1, '#a83a3a');
      px(9, 7, 4, 7, '#a83a3a');
      px(10, 9, 2, 1, '#c94a4a');
      break;
    case 'cape':
      px(4, 3, 8, 2, '#3f7050');
      px(2, 5, 12, 9, '#2f5a3c');
      px(6, 5, 4, 9, '#3f7050');
      px(2, 13, 5, 1, '#25482f');
      px(9, 13, 5, 1, '#25482f');
      break;
    default:
      px(4, 4, 8, 8, '#888');
  }
}

/* ------------------------- Рисование персонажа ---------------------------- */

// Рисует персонажа так, что (cx, cy) — точка под ногами (центр стоп).
// dir: 'down' | 'up' | 'left' | 'right'; frame: 0 — стоит, 1/2 — шаги.
function drawCharacter(g, cx, cy, scale, def, eyeColor, dir, frame, plain) {
  const originX = Math.round(cx - (SPR_W / 2) * scale);
  const originY = Math.round(cy - SPR_H * scale);

  g.save();
  g.translate(originX, originY);
  if (dir === 'left') {
    // левое направление — зеркало правого
    g.translate(SPR_W * scale, 0);
    g.scale(-1, 1);
  }

  const px = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x * scale, y * scale, w * scale, h * scale);
  };

  const side = dir === 'left' || dir === 'right';
  const back = dir === 'up';
  const step = frame === 0 ? 0 : frame === 1 ? -1 : 1; // сдвиг ног при ходьбе

  // --- ноги и кроссовки ---
  if (side) {
    px(4 + (step > 0 ? 1 : 0), 13, 2, 2, def.pants);
    px(6 - (step < 0 ? 1 : 0), 13, 2, 2, shade(def.pants, -0.15));
    px(3 + (step > 0 ? 1 : 0), 15, 3, 1, SHOES);
    px(6 - (step < 0 ? 1 : 0), 15, 3, 1, SHOES);
  } else {
    px(3, 13, 2, 2, def.pants);
    px(7, 13, 2, 2, def.pants);
    px(3 + (step < 0 ? -1 : 0), 15, 2, 1, SHOES);
    px(7 + (step > 0 ? 1 : 0), 15, 2, 1, SHOES);
  }

  // --- туловище ---
  if (side) {
    px(4, 9, 4, 4, def.shirt);
    px(4, 12, 4, 1, def.shirtDark);
    px(5, 9, 2, 3, def.shirt);
    px(5 - step, 10, 2, 2, def.skin); // рука, качается при ходьбе
  } else {
    px(3, 9, 6, 4, def.shirt);
    px(3, 12, 6, 1, def.shirtDark);
    px(2, 9 + (step < 0 ? 1 : 0), 1, 3, def.skin); // левая рука
    px(9, 9 + (step > 0 ? 1 : 0), 1, 3, def.skin); // правая рука
    px(5, 8, 2, 1, def.skin); // шея
  }

  // --- голова ---
  if (back) {
    px(3, 3, 6, 6, def.hair); // сзади видны только волосы
    px(3, 8, 6, 1, def.skin);
  } else {
    px(3, 3, 6, 6, def.skin);
  }

  // --- волосы ---
  drawHair(px, def, dir);

  // --- лицо ---
  if (!back) {
    if (side) {
      px(6, 5, 1, 2, eyeColor);
      px(9, 6, 1, 1, def.skin); // носик
      px(7, 7, 2, 1, shade(def.skin, -0.35)); // ротик
    } else {
      px(4, 5, 1, 2, eyeColor);
      px(7, 5, 1, 2, eyeColor);
      px(5, 7, 2, 1, shade(def.skin, -0.35));
    }
  }

  // --- купленная одежда (шапка, очки, шарф, плащ); у NPC её нет ---
  if (!plain) drawOutfit(px, side, back);

  g.restore();
}

// Одежда рисуется поверх готового персонажа, тем же «пиксельным» способом.
function drawOutfit(px, side, back) {
  const worn = progress.worn;
  const has = (id) => !!worn[id];

  // плащ — тёмные полы по бокам, воротник и пряжка на поясе
  if (has('cape')) {
    if (side) {
      px(4, 9, 1, 4, '#2f5a3c');
      px(7, 8, 1, 1, '#3f7050');
    } else {
      px(3, 9, 1, 4, '#2f5a3c');
      px(8, 9, 1, 4, '#2f5a3c');
      px(3, 8, 6, 1, '#3f7050');
      px(5, 11, 2, 1, '#ffd45c');
    }
  }

  // шарф
  if (has('scarf')) {
    if (side) {
      px(4, 8, 4, 1, '#c94a4a');
    } else {
      px(3, 8, 6, 1, '#c94a4a');
      if (!back) px(7, 9, 2, 2, '#a83a3a');
    }
  }

  // очки (глаз тогда не видно — их закрывают линзы)
  if (has('glasses') && !back) {
    if (side) {
      px(5, 4, 3, 1, '#2b2b33');
      px(5, 4, 1, 2, '#2b2b33');
      px(7, 4, 1, 2, '#2b2b33');
      px(6, 5, 1, 1, '#9ad0f5');
    } else {
      px(3, 4, 2, 2, '#2b2b33');
      px(7, 4, 2, 2, '#2b2b33');
      px(5, 5, 2, 1, '#2b2b33');
      px(2, 5, 1, 1, '#2b2b33');
      px(9, 5, 1, 1, '#2b2b33');
      px(4, 5, 1, 1, '#9ad0f5');
      px(8, 5, 1, 1, '#9ad0f5');
    }
  }

  // шапка: корона важнее шляпы, шляпа важнее кепки
  if (has('crown')) {
    px(3, 0, 6, 2, '#f0c840');
    px(3, -1, 1, 1, '#f0c840');
    px(5, -2, 2, 2, '#f0c840');
    px(9, -1, 1, 1, '#f0c840');
    px(4, 1, 1, 1, '#c0392b');
    px(7, 1, 1, 1, '#3f7fd0');
  } else if (has('strawHat')) {
    px(3, 0, 6, 3, '#e8c85a');
    px(3, 2, 6, 1, '#a5822c');
    if (back) px(1, 3, 10, 1, '#d9b45a');
    else if (side) px(2, 3, 10, 1, '#d9b45a');
    else px(0, 3, 12, 1, '#d9b45a');
  } else if (has('cap')) {
    px(2, 1, 8, 2, '#c0392b');
    if (back) px(2, 3, 8, 1, '#a52c2c');
    else if (side) px(3, 3, 9, 1, '#a52c2c');
    else px(1, 3, 10, 1, '#a52c2c');
  }
}

function drawHair(px, def, dir) {
  const h = def.hair;
  const hd = shade(h, -0.2);
  const back = dir === 'up';
  const side = dir === 'left' || dir === 'right';

  if (def.hairStyle === 'short') {
    px(3, 2, 6, 1, h);
    px(2, 3, 8, 1, h);
    px(2, 4, 1, 2, hd);
    px(9, 4, 1, 2, hd);
    if (side) px(2, 4, 1, 3, h);
    if (back) px(3, 3, 6, 4, h);
    return;
  }

  // длинные волосы: прямые или кудрявые
  px(2, 1, 8, 3, h);
  px(1, 4, 2, 7, h); // левая прядь
  px(9, 4, 2, 7, h); // правая прядь
  if (def.hairStyle === 'curly') {
    // кудри — «пузырьки» по краям причёски
    px(1, 2, 1, 2, h);
    px(10, 2, 1, 2, h);
    px(3, 0, 2, 1, h);
    px(6, 0, 2, 1, h);
    px(0, 6, 1, 3, hd);
    px(11, 6, 1, 3, hd);
    px(1, 11, 2, 1, hd);
    px(9, 11, 2, 1, hd);
  } else {
    px(1, 11, 2, 1, hd);
    px(9, 11, 2, 1, hd);
  }
  if (side) {
    // сбоку волосы падают на спину
    px(1, 4, 2, 9, h);
    px(9, 4, 1, 4, h);
  }
  if (back) px(3, 3, 6, 5, h);
}

// Осветлить (amount > 0) или затемнить (amount < 0) hex-цвет.
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let gg = (n >> 8) & 255;
  let b = n & 255;
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  r = f(r);
  gg = f(gg);
  b = f(b);
  return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
}

/* ------------------------------- Карта леса ------------------------------ */

const WORLD_W = 1920;
const WORLD_H = 1440;

// Детерминированный генератор — карта одинаковая при каждом запуске.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Лес — главная зона. Пещеры строятся отдельно (см. buildCave).
const forest = {
  kind: 'forest',
  w: WORLD_W,
  h: WORLD_H,
  objects: [],
  grass: [],
  pond: { x: 1420, y: 1010, rx: 150, ry: 95 },
};

// Зона, по которой ходим прямо сейчас: лес или одна из пещер.
let world = forest;

/* ------------------- Постоянные места: избушка, огород, ворота ------------ */

// Их координаты не случайны, чтобы к боссам всегда было куда идти.
const YAGA_HOME = { x: 420, y: 340 }; // избушка Бабы-яги на курьих ножках
const YAGA_GARDEN = { x: 560, y: 398 }; // её огород с морковью (закрыт до победы)
const FOREST_GATE = { x: 1250, y: 170 }; // ворота — выход из леса
const LESHY_HOME = { x: 1250, y: 265 }; // Леший стоит на посту перед воротами
const SHOP_HOME = { x: 1082, y: 652 }; // лавка одежды — недалеко от старта
const HOUSE_POTIONS = 3; // сколько зелий лежит в избушке

// Лесные ворота: пока Леший жив, они заперты.

function buildWorld() {
  const world = forest; // генерируем именно лес
  const rnd = mulberry32(20240501);
  const objects = [];
  const startX = WORLD_W / 2;
  const startY = WORLD_H / 2;

  const farFromStart = (x, y) => Math.hypot(x - startX, y - startY) > 110;
  const inPond = (x, y) => {
    const p = world.pond;
    return ((x - p.x) / (p.rx + 30)) ** 2 + ((y - p.y) / (p.ry + 30)) ** 2 < 1;
  };
  const free = (x, y, r) =>
    objects.every((o) => Math.hypot(o.x - x, o.y - y) > r + o.r + 6);

  const place = (type, count, r, extra) => {
    let tries = 0;
    let made = 0;
    while (made < count && tries < count * 60) {
      tries++;
      const x = 60 + rnd() * (WORLD_W - 120);
      const y = 80 + rnd() * (WORLD_H - 120);
      if (!farFromStart(x, y) || inPond(x, y) || !free(x, y, r)) continue;
      const o = { type, x, y, r, seed: rnd() };
      if (extra) extra(o, rnd);
      objects.push(o);
      made++;
    }
  };

  place('tree', 140, 22, (o, r) => {
    o.h = 54 + Math.floor(r() * 26);
    o.crown = 30 + Math.floor(r() * 14);
    o.tint = r();
    o.hitR = 11;
  });
  place('rock', 22, 16, (o, r) => {
    o.w = 20 + Math.floor(r() * 16);
    o.hitR = o.w / 2;
  });

  // Деревья с едой: яблони, банановые пальмы и грядки с овощами.
  place('appleTree', 14, 24, (o, r) => {
    o.h = 50 + Math.floor(r() * 14);
    o.crown = 30 + Math.floor(r() * 8);
    o.hitR = 11;
    initFood(o, r);
  });
  place('bananaTree', 10, 22, (o, r) => {
    o.h = 62 + Math.floor(r() * 16);
    o.crown = 26;
    o.hitR = 9;
    initFood(o, r);
  });
  place('vegetable', 20, 12, (o, r) => {
    o.veg = VEGGIES[Math.floor(r() * VEGGIES.length)];
    initFood(o, r);
  });
  place('bush', 40, 14, (o) => {
    o.leaves = LEAF_MAX;
    o.timer = 0;
  });

  // Ресурсы для крафта: сухие палки, угольные камни и коробки со спичками.
  place('stick', 70, 8, (o, r) => {
    o.taken = false;
    o.timer = 0;
    o.angle = r() * Math.PI;
  });
  place('coalRock', 12, 16, (o, r) => {
    o.w = 22 + Math.floor(r() * 10);
    o.hitR = o.w / 2;
    o.charges = COAL_MAX;
    o.timer = 0;
  });
  place('matchbox', 8, 8, (o) => {
    o.taken = false;
    o.timer = 0;
  });

  // Входы в пещеры: чем дальше номер, тем злее летучие мыши внутри.
  let caveNo = 0;
  place('caveEntry', CAVE_COUNT, 40, (o) => {
    o.level = ++caveNo;
    o.hitR = 22;
  });

  place('mushroom', 30, 5);
  place('flower', 70, 4, (o, r) => {
    o.color = ['#f2e46a', '#f0f0f0', '#e88fc4', '#9ad0f5'][Math.floor(r() * 4)];
  });

  // --- постоянные места: избушка с огородом и ворота из леса ---
  // расчищаем площадки, чтобы деревья не стояли в стенах избушки
  const clearSpot = (x, y, rad) => {
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.type === 'caveEntry') continue; // вход в пещеру не трогаем
      if (Math.hypot(o.x - x, o.y - y) < rad + (o.hitR || 24)) objects.splice(i, 1);
    }
  };
  clearSpot(YAGA_HOME.x, YAGA_HOME.y, 104);
  clearSpot(YAGA_GARDEN.x, YAGA_GARDEN.y, 44);
  clearSpot(FOREST_GATE.x, FOREST_GATE.y, 86);
  clearSpot(LESHY_HOME.x, LESHY_HOME.y, 62);
  clearSpot(SHOP_HOME.x, SHOP_HOME.y, 80);

  objects.push({ type: 'yagaHouse', x: YAGA_HOME.x, y: YAGA_HOME.y, r: 70, hitR: 42, seed: 0.42, potions: HOUSE_POTIONS });
  const garden = { type: 'carrotPatch', x: YAGA_GARDEN.x, y: YAGA_GARDEN.y, r: 34, seed: 0.81 };
  initFood(garden, mulberry32(4242));
  objects.push(garden);
  objects.push({ type: 'forestExit', x: FOREST_GATE.x, y: FOREST_GATE.y, r: 50, hitR: 26, seed: 0.15 });
  objects.push({ type: 'shopCart', x: SHOP_HOME.x, y: SHOP_HOME.y, r: 44, hitR: 30, seed: 0.6 });

  // Небольшие кустики травы — только фон, без столкновений.
  const grass = [];
  for (let i = 0; i < 900; i++) {
    grass.push({ x: rnd() * WORLD_W, y: rnd() * WORLD_H, t: rnd() });
  }

  world.objects = objects;
  world.grass = grass;
}

/* ------------------------------- Пещеры ---------------------------------- */

const CAVE_COUNT = 3; // сколько входов в пещеры разбросано по лесу
const CAVE_W = 1200;
const CAVE_H = 900;
const CRYSTAL_MAX = 2; // сколько кристаллов даёт одна друза
const CRYSTAL_REGROW = 90;

const caves = {}; // построенные пещеры по номеру: { 1: {...}, 2: {...} }

// Пещера строится один раз при первом входе и потом помнит своё состояние.
function buildCave(level) {
  if (caves[level]) return caves[level];
  const rnd = mulberry32(1000 + level * 77);
  const cave = { kind: 'cave', level, w: CAVE_W, h: CAVE_H, objects: [], grass: [] };
  const entry = { x: CAVE_W / 2, y: CAVE_H - 90 };
  cave.entry = entry;

  const objects = [];
  const free = (x, y, r) =>
    Math.hypot(x - entry.x, y - entry.y) > 90 &&
    objects.every((o) => Math.hypot(o.x - x, o.y - y) > r + o.r + 8);

  const place = (type, count, r, extra) => {
    let made = 0;
    let tries = 0;
    while (made < count && tries < count * 60) {
      tries++;
      const x = 70 + rnd() * (CAVE_W - 140);
      const y = 90 + rnd() * (CAVE_H - 160);
      if (!free(x, y, r)) continue;
      const o = { type, x, y, r, seed: rnd() };
      if (extra) extra(o, rnd);
      objects.push(o);
      made++;
    }
  };

  // выход наружу — прямо на месте входа
  objects.push({ type: 'caveExit', x: entry.x, y: entry.y, r: 26, seed: 0 });

  place('caveRock', 26 + level * 3, 26, (o, r) => {
    o.w = 34 + Math.floor(r() * 26);
    o.hitR = o.w / 2;
  });
  place('stalagmite', 30, 12, (o, r) => {
    o.h = 20 + Math.floor(r() * 22);
    o.hitR = 7;
  });
  // ради чего лезем в пещеру: уголь и кристаллы (кристаллов глубже больше)
  place('caveCoal', 10, 16, (o, r) => {
    o.w = 24 + Math.floor(r() * 10);
    o.hitR = o.w / 2;
    o.charges = COAL_MAX;
    o.timer = 0;
  });
  place('crystal', 5 + level * 2, 14, (o, r) => {
    o.charges = CRYSTAL_MAX;
    o.timer = 0;
    o.tint = r();
  });
  place('puddle', 10, 10, (o, r) => {
    o.w = 16 + Math.floor(r() * 22);
  });

  cave.objects = objects;
  caves[level] = cave;
  return cave;
}

// Переход между лесом и пещерой.
function enterCave(level) {
  forestReturn.x = player.x;
  forestReturn.y = player.y;
  cancelBoss(false); // бой с боссом прерывается: он остаётся в лесу
  const cave = buildCave(level);
  world = cave;
  player.x = cave.entry.x;
  player.y = cave.entry.y + 40;
  player.dir = 'up';
  enemies.length = 0;
  arrows.length = 0;
  bombs.length = 0;
  batTimer = 2;
  nearObj = null;
  say('Пещера №' + level + ' — тут водятся летучие мыши', '#cfa6f5');
}

function exitCave() {
  world = forest;
  player.x = forestReturn.x;
  player.y = forestReturn.y + 34;
  player.dir = 'down';
  enemies.length = 0;
  arrows.length = 0;
  bombs.length = 0;
  nearObj = null;
  say('Снова в лесу', '#a6e07a');
}

const forestReturn = { x: WORLD_W / 2, y: WORLD_H / 2 };

/* -------------------------------- Город ---------------------------------- */

const CITY_W = 1400;
const CITY_H = 900;

const city = { kind: 'city', w: CITY_W, h: CITY_H, objects: [], grass: [] };

// Жители города: как выглядят, как зовут и что говорят.
const NPC_DEFS = {
  elder: {
    name: 'Староста Игнат',
    eye: '#2f6fd0',
    def: { hair: '#d8d4c8', hairStyle: 'short', skin: '#e8c39a', shirt: '#6b4a2a', shirtDark: '#553a20', pants: '#3a3a42' },
    lines: [
      'Вот ты и выбрался из леса! А мы уж думали, Леший так и не выпустит никого.',
      'Городок наш небольшой, но живой: пекарня, кузница, лавка одежды.',
      'За восточной заставой начинается другая земля. Туда пока никто не ходил.',
      'Отдохни, герой. Дорогу на восток ещё рисуют — вторая часть впереди.',
    ],
    action: 'finish',
  },
  girl: {
    name: 'Мила',
    eye: '#2f9e4f',
    def: { hair: '#e8c85a', hairStyle: 'curly', skin: '#f6d0ac', shirt: '#e88fc4', shirtDark: '#c86f9f', pants: '#4a6fb5' },
    lines: [
      'Ты правда победил Лешего? Вот это да!',
      'А Баба-яга правда летает в ступе? Я её немножко боюсь.',
      'У меня есть пёс Бублик, но он всё время спит у колодца.',
    ],
  },
  baker: {
    name: 'Пекарь Тихон',
    eye: '#2f6fd0',
    def: { hair: '#f2ead6', hairStyle: 'short', skin: '#f0c39a', shirt: '#f2ead6', shirtDark: '#d9cfc0', pants: '#8a6234' },
    lines: [
      'Свежие пирожки! С капустой, с яблоками, с чем бог послал.',
      'Держи один, герою не грех подкрепиться.',
    ],
    action: 'pie',
  },
  smith: {
    name: 'Кузнец Руд',
    eye: '#1a1a1a',
    def: { hair: '#241710', hairStyle: 'short', skin: '#c98d5f', shirt: '#4a4a52', shirtDark: '#3a3a42', pants: '#26262f' },
    lines: [
      'Лук у тебя знатный. Кристальный? Уважаю.',
      'Ковать настоящее оружие — это тебе не палки собирать.',
      'Будет вторая часть — будут и новые клинки.',
    ],
  },
  tailor: {
    name: 'Торговка Агафья',
    eye: '#cc2b2b',
    def: { hair: '#a4453a', hairStyle: 'long', skin: '#e8c39a', shirt: '#7a4a9a', shirtDark: '#5f3a7a', pants: '#3a3a42' },
    lines: [
      'Одежда — моя слабость. И твоя, судя по наряду.',
      'Заходи, примерь что-нибудь. Алмазики у тебя есть?',
    ],
    action: 'shop',
  },
};

function buildCity() {
  const o = [];

  // дома и лавки по сторонам площади
  o.push({
    type: 'house', x: 300, y: 300, w: 150, h: 96, wall: '#d8c9a8', roof: '#a4453a',
    sign: 'РАТУША', hitR: 50, seed: 0.1, box: { x0: 225, y0: 204, x1: 375, y1: 300 },
  });
  o.push({
    type: 'house', x: 1080, y: 300, w: 130, h: 88, wall: '#e0cfae', roof: '#8a5a3a',
    sign: 'ПЕКАРНЯ', hitR: 44, seed: 0.2, box: { x0: 1015, y0: 212, x1: 1145, y1: 300 },
  });
  o.push({
    type: 'house', x: 350, y: 690, w: 120, h: 84, wall: '#cfd6d8', roof: '#4a6b8a',
    sign: 'ОДЕЖДА', hitR: 42, seed: 0.3, box: { x0: 290, y0: 606, x1: 410, y1: 690 },
  });
  o.push({
    type: 'forge', x: 1080, y: 700, w: 130, h: 90, sign: 'КУЗНИЦА', hitR: 44, seed: 0.4,
    box: { x0: 1015, y0: 610, x1: 1145, y1: 700 },
  });

  // колодец в центре площади
  o.push({ type: 'well', x: 700, y: 470, hitR: 22, seed: 0.5 });
  // ворота в лес (юг)
  o.push({ type: 'cityGate', x: 700, y: 820, hitR: 36, seed: 0.6 });
  // указатель на восток — задел на вторую часть
  o.push({
    type: 'sign', x: 1240, y: 520, hitR: 6, seed: 0.7, name: 'Указатель',
    lines: [
      'На дощечке написано: «НА ВОСТОК».',
      'Дорога уходит за горизонт. Там начинается вторая часть — её ещё пишут.',
      'А пока можно вернуться в лес или погулять по городу.',
    ],
  });

  // фонари, скамейка, заборчик и деревья
  for (const [lx, ly] of [[420, 360], [880, 360], [420, 660], [880, 660], [620, 545], [790, 330]]) {
    o.push({ type: 'lantern', x: lx, y: ly, hitR: 5, seed: lx * 0.01 + ly * 0.02 });
  }
  o.push({ type: 'bench', x: 830, y: 500, hitR: 0, seed: 0.9 });
  o.push({ type: 'crate', x: 968, y: 332, hitR: 9, seed: 0.71 });
  o.push({ type: 'crate', x: 996, y: 352, hitR: 9, seed: 0.72 });
  o.push({ type: 'barrel', x: 986, y: 748, hitR: 8, seed: 0.73 });
  o.push({ type: 'barrel', x: 452, y: 700, hitR: 8, seed: 0.74 });
  o.push({ type: 'tree', x: 150, y: 560, h: 58, crown: 32, tint: 0.2, hitR: 11, seed: 0.41 });
  o.push({ type: 'tree', x: 1268, y: 742, h: 60, crown: 33, tint: 0.7, hitR: 11, seed: 0.45 });
  o.push({ type: 'tree', x: 180, y: 300, h: 56, crown: 30, tint: 0.35, hitR: 11, seed: 0.46 });
  o.push({ type: 'tree', x: 1250, y: 260, h: 62, crown: 34, tint: 0.6, hitR: 11, seed: 0.42 });
  o.push({ type: 'flower', x: 620, y: 585, color: '#f2e46a', r: 4, seed: 0.43 });
  o.push({ type: 'flower', x: 790, y: 600, color: '#e88fc4', r: 4, seed: 0.44 });

  // жители
  o.push({ type: 'npc', npc: 'elder', x: 300, y: 392, r: 9, hitR: 9, seed: 1, ...NPC_DEFS.elder });
  o.push({ type: 'npc', npc: 'girl', x: 628, y: 512, r: 9, hitR: 9, seed: 1.1, ...NPC_DEFS.girl });
  o.push({ type: 'npc', npc: 'baker', x: 1080, y: 356, r: 9, hitR: 9, seed: 1.2, ...NPC_DEFS.baker });
  o.push({ type: 'npc', npc: 'smith', x: 1080, y: 762, r: 9, hitR: 9, seed: 1.3, ...NPC_DEFS.smith });
  o.push({ type: 'npc', npc: 'tailor', x: 350, y: 752, r: 9, hitR: 9, seed: 1.4, ...NPC_DEFS.tailor });
  o.push({
    type: 'dog', x: 762, y: 530, r: 8, hitR: 0, seed: 1.5, name: 'Пёс Бублик',
    lines: ['Гав!', 'Пёс довольно сопит и виляет хвостом.', 'Кажется, он всё-таки спит.'],
  });

  city.objects = o;
}

// Переходы между лесом и городом.
function enterCity() {
  cancelBoss(false);
  world = city;
  player.x = 700;
  player.y = 770;
  player.dir = 'up';
  enemies.length = 0;
  arrows.length = 0;
  bombs.length = 0;
  potions.length = 0;
  roots.length = 0;
  nearObj = null;
  dialog = null;
  say('Город Зелёный Бор! Староста ждёт у ратуши', '#ffdf7a');
}

function exitCity() {
  world = forest;
  player.x = FOREST_GATE.x;
  player.y = FOREST_GATE.y + 78;
  player.dir = 'down';
  enemies.length = 0;
  nearObj = null;
  say('Снова в лесу. Страшно, но привычно', '#a6e07a');
}

/* ------------------------------ Разговоры --------------------------------- */

let dialog = null; // { name, lines, i, face, action, t }
let cityPieGiven = false;

function startDialog(o) {
  dialog = {
    name: o.name || 'Незнакомец',
    lines: o.lines && o.lines.length ? o.lines : ['...'],
    i: 0,
    face: o.face || o.npc || null,
    action: o.action || null,
    t: 0,
  };
  craftOpen = false;
  shopOpen = false;
  player.moving = false;
  mouse.clicked = false;
  keys.clear();
}

function advanceDialog() {
  if (!dialog) return;
  if (dialog.i + 1 < dialog.lines.length) {
    dialog.i++;
    return;
  }
  const action = dialog.action;
  dialog = null;
  if (action === 'finish') finishGame();
  else if (action === 'shop') {
    shopOpen = true;
    shopSel = 0;
    mouse.clicked = false;
  } else if (action === 'pie') givePie();
}

function closeDialog() {
  dialog = null;
  player.moving = false;
}

// Пекарь угощает пирожком — раз за забег.
function givePie() {
  if (cityPieGiven) {
    say('Пирожки на сегодня закончились — приходи завтра', '#cfe3d2');
    return;
  }
  if (!addItem('pie')) {
    say('Инвентарь полон', '#ff9a8a');
    return;
  }
  cityPieGiven = true;
  say('Пирожок в кармане: +35 сытости', '#ffdf7a');
}

// Заготовка съедобного объекта: сколько плодов и где они висят.
function initFood(o, r) {
  const cfg = FOOD[o.type];
  o.fruits = cfg.max;
  o.timer = 0;
  o.spots = [];
  for (let i = 0; i < cfg.max; i++) {
    const a = (i / cfg.max) * Math.PI * 2 + r() * 0.8;
    const rad = o.type === 'vegetable' ? 8 + r() * 4 : (o.crown || 20) * (0.45 + r() * 0.3);
    o.spots.push({ dx: Math.cos(a) * rad, dy: Math.sin(a) * rad * 0.7 });
  }
}

/* ------------------------------- Игрок ----------------------------------- */

const player = {
  x: WORLD_W / 2,
  y: WORLD_H / 2,
  r: 9,
  speed: 118,
  dir: 'down',
  moving: false,
  animTime: 0,
  hp: MAX_HP,
  hunger: MAX_HUNGER,
  eaten: 0, // сколько всего съедено — просто счётчик для интереса
  defeated: 0, // сколько врагов побеждено
  invuln: 0, // короткая неуязвимость после укуса
  flash: 0, // красная вспышка при уроне
  poison: 0, // сколько секунд ещё действует яд из зелёного зелья
};

let faintReason = 'Ты обессилел от голода';

const HUNGER_PER_SEC = 100 / 300; // полная полоска голода тратится примерно за 5 минут
const STARVE_DAMAGE = 1 / 3; // на пустой голод — минус 1 HP каждые 3 секунды
const HEAL_PER_SEC = 1 / 6; // сытый персонаж потихоньку восстанавливает здоровье

/* --------------------------- День и ночь ---------------------------------- */

// Сутки: длинный день, закат, ночь, рассвет. Всего примерно 3,5 минуты.
const PHASES = [
  { name: 'день', len: 120, from: 0, to: 0 },
  { name: 'вечер', len: 20, from: 0, to: 1 },
  { name: 'ночь', len: 60, from: 1, to: 1 },
  { name: 'утро', len: 20, from: 1, to: 0 },
];
const DAY_LEN = PHASES.reduce((s, p) => s + p.len, 0);

const clock = { t: 0, day: 1 };

// Насколько сейчас темно: 0 — светлый день, 1 — глухая ночь.
function darkness() {
  let t = clock.t;
  for (const p of PHASES) {
    if (t < p.len) return p.from + (p.to - p.from) * (t / p.len);
    t -= p.len;
  }
  return 0;
}

function phaseName() {
  let t = clock.t;
  for (const p of PHASES) {
    if (t < p.len) return p.name;
    t -= p.len;
  }
  return 'день';
}

const isNight = () => darkness() > 0.45;

const camera = { x: 0, y: 0 };
const floaters = []; // всплывающие надписи «+12» над головой
let nearObj = null; // объект, до которого можно дотянуться прямо сейчас
let craftOpen = false; // открыто ли окно крафта
let shopOpen = false; // открыта ли лавка одежды
const sleep = { active: false, t: 0 }; // анимация сна

// Короткое сообщение над головой персонажа. Одно и то же не дублируем.
function say(text, color) {
  const last = floaters[floaters.length - 1];
  if (last && last.text === text && last.t < 0.8) {
    last.t = 0;
    last.x = player.x;
    last.y = player.y - 46;
    return;
  }
  floaters.push({ x: player.x, y: player.y - 46, t: 0, text, color: color || '#f4e9c8' });
}

/* ------------------------------- Бой ------------------------------------- */

const arrows = []; // летящие стрелы
const bombs = []; // брошенные бомбы
const enemies = []; // волки в лесу и летучие мыши в пещере

const ARROW_SPEED = 360;
const ARROW_DAMAGE = 5;
const SHOOT_COOLDOWN = 0.45;
const BOMB_DAMAGE = 30;
const BOMB_RADIUS = 85;

let shootTimer = 0;
let wolfTimer = 4;
let batTimer = 3;

// Волки одинаковые, а летучие мыши в глубоких пещерах сильнее.
function wolfStats() {
  return { hp: 16, dmg: 4, speed: 96, reach: 22, cd: 1.1, r: 13 };
}
function batStats(level) {
  return {
    hp: 6 + (level - 1) * 4,
    dmg: 2 + level,
    speed: 96 + level * 14,
    reach: 20,
    cd: 0.9,
    r: 11,
  };
}

function spawnEnemy(kind, x, y) {
  const st = kind === 'wolf' ? wolfStats() : batStats(world.level || 1);
  enemies.push({
    kind,
    x,
    y,
    hp: st.hp,
    maxHp: st.hp,
    st,
    dir: 'left',
    cool: 0,
    hurt: 0,
    phase: Math.random() * Math.PI * 2,
  });
}

// Точка подальше от игрока, но в пределах карты и не внутри камня.
function findSpawnSpot(minD, maxD) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = minD + Math.random() * (maxD - minD);
    const x = clamp(player.x + Math.cos(a) * d, 40, world.w - 40);
    const y = clamp(player.y + Math.sin(a) * d, 60, world.h - 40);
    if (Math.hypot(x - player.x, y - player.y) < minD * 0.7) continue;
    if (!collides(x, y)) return { x, y };
  }
  return null;
}

function updateSpawning(dt) {
  if (boss.active) return; // во время боя с боссом волки не лезут под руку
  if (world.kind === 'city') return; // в городе никаких волков и мышей
  if (world.kind === 'forest') {
    // волки выходят к лесу только ночью, и чем дальше день — тем их больше
    if (!isNight()) {
      // на рассвете стая разбегается
      for (let i = enemies.length - 1; i >= 0; i--) {
        if (Math.hypot(enemies[i].x - player.x, enemies[i].y - player.y) > 260) enemies.splice(i, 1);
      }
      wolfTimer = 4;
      return;
    }
    const maxWolves = Math.min(6, 2 + Math.floor(clock.day / 2));
    wolfTimer -= dt;
    if (wolfTimer <= 0 && enemies.length < maxWolves) {
      wolfTimer = 6;
      const s = findSpawnSpot(360, 520);
      if (s) spawnEnemy('wolf', s.x, s.y);
    }
  } else {
    const maxBats = 3 + world.level;
    batTimer -= dt;
    if (batTimer <= 0 && enemies.length < maxBats) {
      batTimer = 5;
      const s = findSpawnSpot(240, 420);
      if (s) spawnEnemy('bat', s.x, s.y);
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.hurt > 0) e.hurt -= dt;
    if (e.cool > 0) e.cool -= dt;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist > 16) {
      let vx = dx / dist;
      let vy = dy / dist;
      if (e.kind === 'bat') {
        // мышь летит рывками и петляет
        e.phase += dt * 4;
        vx += Math.cos(e.phase) * 0.55;
        vy += Math.sin(e.phase * 1.3) * 0.55;
        const l = Math.hypot(vx, vy) || 1;
        vx /= l;
        vy /= l;
      }
      const step = e.st.speed * dt * (e.hurt > 0 ? 0.5 : 1);
      const nx = clamp(e.x + vx * step, 20, world.w - 20);
      const ny = clamp(e.y + vy * step, 40, world.h - 20);
      // волк обходит деревья, мышь летит над камнями
      if (e.kind === 'bat' || !collides(nx, ny)) {
        e.x = nx;
        e.y = ny;
      } else if (!collides(nx, e.y)) {
        e.x = nx;
      } else if (!collides(e.x, ny)) {
        e.y = ny;
      }
      e.dir = dx > 0 ? 'right' : 'left';
    }

    // укус
    if (dist < e.st.reach + player.r && e.cool <= 0) {
      e.cool = e.st.cd;
      hurtPlayer(e.st.dmg, dx / dist, dy / dist);
    }
  }
}

// Урон игроку: мигание, отскок и проверка смерти. reason — кто одолел.
function hurtPlayer(dmg, dirX, dirY, reason) {
  if (player.invuln > 0) return;
  player.hp -= dmg;
  player.invuln = 0.6;
  player.flash = 0.3;
  moveAxis(dirX * 14, 0);
  moveAxis(0, dirY * 14);
  floaters.push({ x: player.x, y: player.y - 40, t: 0, text: '-' + dmg, color: '#ff7a6a' });
  if (player.hp <= 0) {
    player.hp = 0;
    faintReason =
      reason ||
      (world.kind === 'cave' ? 'Летучие мыши оказались сильнее' : 'Волки оказались сильнее');
    state = 'faint';
  }
}

// Выстрел из лука: мышкой — в сторону курсора, кнопкой — в сторону взгляда
// или в заданную точку (автоприцел / правый стик геймпада).
function shoot(atCursor, aimX, aimY) {
  if (shootTimer > 0) return;
  if (!hasBow()) {
    say(
      uiMode === 'touch'
        ? 'Нужен лук — открой «КРАФТ»'
        : uiMode === 'gamepad'
          ? 'Нужен лук — открой крафт (LT)'
          : 'Нужен лук — скрафти его (C)',
      '#ff9a8a'
    );
    return;
  }
  if (!invCount('arrow')) {
    say('Кончились стрелы', '#ff9a8a');
    return;
  }
  let ax;
  let ay;
  if (typeof aimX === 'number' && typeof aimY === 'number' && (aimX || aimY)) {
    ax = aimX;
    ay = aimY;
  } else if (atCursor && mouse.x >= 0 && mouse.y >= 0) {
    ax = mouse.x + camera.x - player.x;
    ay = mouse.y + camera.y - (player.y - 22);
  } else {
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[player.dir];
    ax = d[0];
    ay = d[1];
  }
  const len = Math.hypot(ax, ay) || 1;
  ax /= len;
  ay /= len;
  removeItem('arrow');
  shootTimer = SHOOT_COOLDOWN;
  player.dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : ay > 0 ? 'down' : 'up';
  // x/y стрелы — точка на земле, как у всех объектов; рисуется она на высоте груди
  arrows.push({ x: player.x, y: player.y, vx: ax * ARROW_SPEED, vy: ay * ARROW_SPEED, t: 0 });
}

// Стрела втыкается в дерево или камень (но перелетает через воду и кусты).
function hitsObstacle(x, y) {
  for (const o of world.objects) {
    if (!o.hitR) continue;
    if (Math.abs(o.x - x) > o.hitR + 4 || Math.abs(o.y - y) > o.hitR + 4) continue;
    if (Math.hypot(o.x - x, o.y - y) < o.hitR + 3) return true;
  }
  return false;
}

function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.t += dt;
    let gone = a.t > 1.6;

    // летим маленькими шажками, чтобы стрела не «перепрыгнула» врага на слабом кадре
    const steps = Math.max(1, Math.ceil((ARROW_SPEED * dt) / 8));
    for (let s = 0; s < steps && !gone; s++) {
      a.x += (a.vx * dt) / steps;
      a.y += (a.vy * dt) / steps;
      if (a.x < 0 || a.y < 0 || a.x > world.w || a.y > world.h) {
        gone = true;
        break;
      }
      for (const e of enemies) {
        if (Math.hypot(e.x - a.x, e.y - a.y) < e.st.r + 10) {
          damageEnemy(e, ARROW_DAMAGE);
          gone = true;
          break;
        }
      }
      if (!gone && bossArrowHit(a.x, a.y)) {
        damageBoss(arrowBossDamage(), 'arrow');
        gone = true;
      }
      if (!gone && hitsObstacle(a.x, a.y)) gone = true;
    }
    if (gone) arrows.splice(i, 1);
  }
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  e.hurt = 0.25;
  floaters.push({ x: e.x, y: e.y - 26, t: 0, text: '-' + dmg, color: '#ffdf7a' });
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const i = enemies.indexOf(e);
  if (i >= 0) enemies.splice(i, 1);
  player.defeated++;
  if (e.kind === 'wolf') {
    // с волка — мясо, его жарят на костре
    const n = 1 + (Math.random() < 0.3 ? 1 : 0);
    if (addItem('meat', n)) floaters.push({ x: e.x, y: e.y - 20, t: 0, text: '+' + n + ' мясо', color: '#ffdf7a' });
    else floaters.push({ x: e.x, y: e.y - 20, t: 0, text: 'инвентарь полон', color: '#ff9a8a' });
  } else if (Math.random() < 0.35) {
    if (addItem('crystal')) floaters.push({ x: e.x, y: e.y - 20, t: 0, text: '+1 кристалл', color: '#d9a6f5' });
  }
}

// Бомба летит вперёд, падает и через секунду взрывается.
function throwBomb() {
  const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[player.dir];
  removeItem('bomb');
  bombs.push({
    x: player.x,
    y: player.y,
    vx: d[0] * 190,
    vy: d[1] * 190,
    fly: 0.45,
    fuse: 1.2,
    boom: 0,
  });
  say('Бомба брошена!', '#ffdf7a');
}

function updateBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    if (b.boom > 0) {
      b.boom -= dt;
      if (b.boom <= 0) bombs.splice(i, 1);
      continue;
    }
    if (b.fly > 0) {
      b.fly -= dt;
      const nx = clamp(b.x + b.vx * dt, 20, world.w - 20);
      const ny = clamp(b.y + b.vy * dt, 40, world.h - 20);
      if (!collides(nx, ny)) {
        b.x = nx;
        b.y = ny;
      } else {
        b.fly = 0;
      }
    }
    b.fuse -= dt;
    if (b.fuse <= 0) explode(b);
  }
}

function explode(b) {
  b.boom = 0.4;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (Math.hypot(e.x - b.x, e.y - b.y) < BOMB_RADIUS) damageEnemy(e, BOMB_DAMAGE);
  }
  if (boss.active && Math.hypot(boss.x - b.x, boss.y - b.y) < BOMB_RADIUS) {
    damageBoss(BOMB_DAMAGE, 'bomb');
  }
  // рядом с взрывом достаётся и самому игроку — держись подальше!
  const d = Math.hypot(player.x - b.x, player.y - b.y);
  if (d < BOMB_RADIUS * 0.7) {
    hurtPlayer(4, (player.x - b.x) / (d || 1), (player.y - b.y) / (d || 1), 'Своя же бомба и взорвала');
  }
}

/* ---------------------- Боссы: Баба-яга и Леший --------------------------- */

// Характеристики боссов. arrow — сколько снимает одна стрела (кристальный лук — вдвое).
const BOSSES = {
  yaga: { name: 'БАБА-ЯГА', hp: 140, r: 17, arrow: 20, speed: 84, diamonds: 3 },
  leshy: { name: 'ЛЕШИЙ', hp: 1000, r: 28, arrow: 20, speed: 54, diamonds: 6 },
};

// В игре одновременно бывает только один босс. Пока бой не начат, Баба-яга
// сидит в избушке, а Леший стоит на посту у ворот (см. drawPlay).
const boss = {
  id: null, // 'yaga' | 'leshy' | null
  active: false, // идёт ли бой
  dead: false,
  deadT: 0,
  x: 0,
  y: 0,
  homeX: 0,
  homeY: 0,
  hp: 0,
  maxHp: 0,
  r: 16,
  phase: 1,
  dir: 'left',
  hurt: 0,
  cool: 0, // перезарядка удара лапой (Леший)
  swing: 0, // замах перед ударом
  throwTimer: 0, // когда Баба-яга бросит следующее зелье
  castTimer: 0, // идёт колдовство — стоит на месте
  teleTimer: 0, // когда телепортируется
  rootTimer: 0, // когда Леший выпустит корни
  animTime: 0,
  moving: false,
  line: '', // реплика босса (облачко над головой)
  lineT: 0,
};

let yagaDefeated = false;
let leshyDefeated = false;
let rootHintShown = false;
let victory = null; // экран победы над боссом: { id, stars, gain, t }

const potions = []; // летящие зелья
const splashes = []; // брызги зелья и дым от телепорта
const roots = []; // корни Лешего

let catObj = null; // чёрная кошка Бабы-яги (появляется через раз)

// Кошка говорит то полезное, то просто болтает — как в дизайн-документе.
const CAT_TIPS = [
  'Пока ведьма колдует, она стоит на месте — стреляй именно тогда.',
  'От её зелья спасает только шаг в сторону. Я проверяла.',
  'Огород она охраняет, но морковь там знатная.',
  'В чулане у неё ещё зелья. Синее — лечит, зелёное — нет.',
];

const CAT_JUNK = [
  'Мяу. Рыба была бы сейчас очень кстати.',
  'Я тут просто греюсь, не обращай внимания.',
  'Ты стреляешь, как мой прошлый хозяин. То есть мимо.',
  'Не люблю собак, волков и понедельники.',
  'У ведьмы метла новая. Мне не нравится.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Реплика босса в облачке над головой.
function sayBoss(text) {
  boss.line = text;
  boss.lineT = 3;
}

function startBossFight(id) {
  const def = BOSSES[id];
  boss.id = id;
  boss.active = true;
  boss.dead = false;
  boss.deadT = 0;
  boss.hp = def.hp;
  boss.maxHp = def.hp;
  boss.r = def.r;
  boss.phase = 1;
  boss.hurt = 0;
  boss.cool = 0;
  boss.swing = 0;
  boss.animTime = 0;
  boss.moving = false;
  boss.lineT = 0;
  potions.length = 0;
  roots.length = 0;
  rootHintShown = false;

  if (id === 'yaga') {
    boss.homeX = YAGA_HOME.x;
    boss.homeY = YAGA_HOME.y;
    // выходит из избушки, но не прямо на голову игроку
    boss.x = YAGA_HOME.x + 40;
    boss.y = YAGA_HOME.y + 96;
    if (Math.hypot(boss.x - player.x, boss.y - player.y) < 80) {
      boss.x = YAGA_HOME.x - 96;
      boss.y = YAGA_HOME.y + 64;
    }
    boss.throwTimer = 2.2;
    boss.castTimer = 0;
    boss.teleTimer = 6;
    sayBoss('Кто это в лес ко мне забрёл? Сейчас проучу!');
    say('Баба-яга вышла из избушки! ' + shootHint(), '#ff9a8a');
    if (!catObj && Math.random() < 0.5) spawnCat();
  } else {
    boss.homeX = LESHY_HOME.x;
    boss.homeY = LESHY_HOME.y;
    boss.x = LESHY_HOME.x;
    boss.y = LESHY_HOME.y;
    boss.rootTimer = 4.5;
    sayBoss('Стой! Дальше не пройдёшь, пока я жив.');
    say('Лешего можно ранить только из лука! ' + shootHint(), '#ff9a8a');
  }
}

// Бой прерван: ушли в пещеру или слишком далеко убежали.
function cancelBoss(notify) {
  if (!boss.active) return;
  const id = boss.id;
  boss.active = false;
  boss.id = null; // босс вернулся в своё логово
  boss.hp = boss.maxHp; // и залечил раны
  boss.hurt = 0;
  boss.castTimer = 0;
  boss.swing = 0;
  boss.lineT = 0;
  potions.length = 0;
  roots.length = 0;
  if (notify) {
    say(id === 'yaga' ? 'Баба-яга спряталась в избушке' : 'Леший вернулся к воротам', '#ffd08a');
  }
}

function updateBosses(dt) {
  updateBoss(dt);
  updatePotions(dt);
  updateRoots(dt);
  updateCat(dt);
}

// Босс летает/шагает сквозь лес — деревья ему не помеха.
function moveBoss(nx, ny, speed, dt) {
  const step = speed * dt;
  boss.x = clamp(boss.x + nx * step, 40, world.w - 40);
  boss.y = clamp(boss.y + ny * step, 70, world.h - 30);
  boss.moving = true;
  boss.animTime += dt;
}

function updateBoss(dt) {
  if (boss.dead) {
    boss.deadT += dt;
    if (boss.deadT > 3.2) {
      boss.id = null; // тело убираем, дальше оно не нужно
      boss.dead = false;
    }
    return;
  }

  if (!boss.active) {
    // Леший не подпускает к воротам: подошёл близко — бой начинается
    if (
      !leshyDefeated &&
      world.kind === 'forest' &&
      Math.hypot(player.x - LESHY_HOME.x, player.y - LESHY_HOME.y) < 200
    ) {
      startBossFight('leshy');
    }
    return;
  }

  if (world.kind !== 'forest') {
    cancelBoss(true);
    return;
  }

  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (dist > 820) {
    // сбежал с поля боя — босс не гонится через пол-леса
    cancelBoss(true);
    return;
  }

  if (boss.hurt > 0) boss.hurt -= dt;
  if (boss.lineT > 0) boss.lineT -= dt;
  boss.dir = dx > 0 ? 'right' : 'left';
  boss.moving = false;

  if (boss.id === 'yaga') updateYaga(dt, dist, dx, dy);
  else updateLeshy(dt, dist, dx, dy);
}

/* ------------------------------ Баба-яга ---------------------------------- */

function updateYaga(dt, dist, dx, dy) {
  const def = BOSSES.yaga;

  // вторая половина здоровья — ведьма злится и колдует чаще
  if (boss.phase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.phase = 2;
    sayBoss('Ах ты, дерзкая! Ну держись!');
    say('Баба-яга разозлилась — зелья летят чаще!', '#ff9a8a');
  }

  // колдует: стоит на месте — самый удобный момент для выстрела
  if (boss.castTimer > 0) {
    boss.castTimer -= dt;
    if (boss.castTimer <= 0) throwPotion();
    return;
  }

  // держит дистанцию: подлетает, если далеко, и отлетает, если слишком близко
  const want = 205;
  if (dist < want - 50) moveBoss(-dx / dist, -dy / dist, def.speed, dt);
  else if (dist > want + 55) moveBoss(dx / dist, dy / dist, def.speed, dt);

  boss.throwTimer -= dt;
  if (boss.throwTimer <= 0) {
    boss.castTimer = 0.55;
    boss.throwTimer = boss.phase === 2 ? 1.8 : 2.5;
    sayBoss('Лови зелье!');
  }

  // на второй половине здоровья — телепортируется в клубах дыма
  if (boss.phase === 2) {
    boss.teleTimer -= dt;
    if (boss.teleTimer <= 0) {
      boss.teleTimer = 6;
      teleportBoss();
      sayBoss('Хи-хи-хи!');
    }
  }
}

function throwPotion() {
  const tx = clamp(player.x + (Math.random() - 0.5) * 40, 20, world.w - 20);
  const ty = clamp(player.y + (Math.random() - 0.5) * 40, 40, world.h - 16);
  potions.push({ x: boss.x, y: boss.y - 30, tx, ty, t: 0, dur: 0.8 });
}

function updatePotions(dt) {
  for (let i = potions.length - 1; i >= 0; i--) {
    const p = potions[i];
    p.t += dt;
    if (p.t < p.dur) continue;
    potions.splice(i, 1);
    splashes.push({ x: p.tx, y: p.ty, t: 0, r: 48, color: '#7ad35a', dur: 0.45 });
    const d = Math.hypot(player.x - p.tx, player.y - p.ty);
    if (d < 52) {
      const dd = d || 1;
      hurtPlayer(10, (player.x - p.tx) / dd, (player.y - p.ty) / dd, 'Баба-яга закидала тебя зельями');
    }
  }

  for (let i = splashes.length - 1; i >= 0; i--) {
    splashes[i].t += dt;
    if (splashes[i].t > splashes[i].dur) splashes.splice(i, 1);
  }
}

function teleportBoss() {
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 190 + Math.random() * 130;
    const x = clamp(player.x + Math.cos(a) * d, 60, world.w - 60);
    const y = clamp(player.y + Math.sin(a) * d, 90, world.h - 40);
    if (Math.hypot(x - player.x, y - player.y) < 140) continue;
    boss.x = x;
    boss.y = y;
    splashes.push({ x, y, t: 0, r: 34, color: '#c9a6e0', dur: 0.5 });
    return;
  }
}

/* -------------------------------- Леший ----------------------------------- */

function updateLeshy(dt, dist, dx, dy) {
  const def = BOSSES.leshy;

  // половина здоровья — Леший впадает в ярость
  if (boss.phase === 1 && boss.hp <= boss.maxHp * 0.5) {
    boss.phase = 2;
    sayBoss('Лес… злится…');
    say('Леший разъярён — корни лезут чаще, удар тяжелее!', '#ff9a8a');
  }
  const speed = boss.phase === 2 ? def.speed * 1.35 : def.speed;

  // замах: через 0.35 с лапа обрушится вниз
  if (boss.swing > 0) {
    boss.swing -= dt;
    if (boss.swing <= 0) {
      const d2 = Math.hypot(player.x - boss.x, player.y - boss.y) || 1;
      if (d2 < 96) {
        hurtPlayer(
          boss.phase === 2 ? 11 : 8,
          (player.x - boss.x) / d2,
          (player.y - boss.y) / d2,
          'Леший не пустил тебя из леса'
        );
      }
    }
  }

  if (dist > 84) moveBoss(dx / dist, dy / dist, speed, dt);

  if (boss.cool > 0) boss.cool -= dt;
  else if (dist < 92) {
    boss.cool = boss.phase === 2 ? 1.5 : 1.9;
    boss.swing = 0.35;
    boss.animTime = 0;
    sayBoss('Ух!');
  }

  boss.rootTimer -= dt;
  if (boss.rootTimer <= 0) {
    boss.rootTimer = boss.phase === 2 ? 3.6 : 5.4;
    castRoots();
  }
}

// Корни бьют по площадкам: сначала круг-предупреждение, потом удар.
function castRoots() {
  const spots = [{ x: player.x, y: player.y }];
  for (let i = 0; i < 2; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 70 + Math.random() * 70;
    spots.push({
      x: clamp(player.x + Math.cos(a) * d, 40, world.w - 40),
      y: clamp(player.y + Math.sin(a) * d, 50, world.h - 30),
    });
  }
  for (const s of spots) roots.push({ x: s.x, y: s.y, t: 0, delay: 1, hit: false, life: 0.55 });
  if (!rootHintShown) {
    rootHintShown = true;
    say('Корни лезут из земли — уходи с круга!', '#ffd08a');
  }
}

function updateRoots(dt) {
  for (let i = roots.length - 1; i >= 0; i--) {
    const r = roots[i];
    r.t += dt;
    if (r.t < r.delay) continue;
    if (!r.hit) {
      r.hit = true;
      const d = Math.hypot(player.x - r.x, player.y - r.y);
      if (d < 46) {
        const dd = d || 1;
        hurtPlayer(
          boss.phase === 2 ? 12 : 10,
          (player.x - r.x) / dd,
          (player.y - r.y) / dd,
          'Корни Лешего опутали тебя'
        );
      }
    }
    if (r.t > r.delay + r.life) roots.splice(i, 1);
  }
}

/* ---------------------------- Урон и победа -------------------------------- */

// Урон боссу. Лешего не берёт ничего, кроме стрел.
function damageBoss(dmg, source) {
  if (!boss.active) return;
  if (boss.id === 'leshy' && source !== 'arrow') {
    say('Лешего не пробить ни бомбой, ни кулаком — только лук!', '#ff9a8a');
    return;
  }
  boss.hp -= dmg;
  boss.hurt = 0.22;
  floaters.push({ x: boss.x, y: boss.y - 52, t: 0, text: '-' + dmg, color: '#ffdf7a' });
  if (boss.hp <= 0) {
    boss.hp = 0;
    killBoss();
  }
}

// Можно ли попасть стрелой в босса.
function bossArrowHit(x, y) {
  return boss.active && Math.hypot(boss.x - x, boss.y - y) < boss.r + 9;
}

// Урон стрелы по боссу: кристальный лук бьёт вдвое сильнее.
function arrowBossDamage() {
  return BOSSES[boss.id].arrow * (hasCrystalBow() ? 2 : 1);
}

function killBoss() {
  const id = boss.id;
  boss.active = false;
  boss.dead = true;
  boss.deadT = 0;
  boss.hp = 0;
  boss.castTimer = 0;
  boss.swing = 0;
  potions.length = 0;
  roots.length = 0;

  if (id === 'yaga') {
    yagaDefeated = true;
    boss.line = 'Ох… проиграла. Бери морковь, только кошку не обижай.';
    boss.lineT = 4.5;
    say('Баба-яга побеждена! Огород открыт, в избушке остались зелья', '#ffdf7a');
  } else {
    leshyDefeated = true;
    boss.line = 'Лес… отпускает тебя…';
    boss.lineT = 4.5;
    say('Леший пал! Выход из леса открыт', '#a6e07a');
  }
  finishBoss(id);
}

// Экран победы: звёзды за бой и алмазики. Чем целее здоровье, тем больше звёзд.
function finishBoss(id) {
  const stars = player.hp >= MAX_HP * 0.6 ? 3 : player.hp >= MAX_HP * 0.3 ? 2 : 1;
  const gain = BOSSES[id].diamonds + (stars === 3 ? 1 : 0);
  addDiamonds(gain);
  victory = { id, stars, gain, t: 0 };
  state = 'victory';
  craftOpen = false;
  shopOpen = false;
  player.moving = false;
  mouse.clicked = false;
  potions.length = 0;
  roots.length = 0;
  boss.lineT = 0; // реплики прячем — они всё равно за экраном победы
  floaters.length = 0; // убираем всплывающие надписи, чтобы не мешали картинке
}

/* -------------------------------- Кошка ----------------------------------- */

function spawnCat() {
  if (catObj) return;
  catObj = {
    type: 'cat',
    x: YAGA_HOME.x - 84,
    y: YAGA_HOME.y + 52,
    r: 8,
    seed: 0.5,
    sayT: 5,
    line: '',
    lineT: 0,
  };
  forest.objects.push(catObj);
}

function updateCat(dt) {
  if (!catObj) return;
  if (catObj.lineT > 0) catObj.lineT -= dt;
  if (!boss.active) return;
  catObj.sayT -= dt;
  if (catObj.sayT <= 0) {
    catObj.sayT = 7 + Math.random() * 5;
    catObj.line = Math.random() < 0.5 ? pick(CAT_TIPS) : pick(CAT_JUNK);
    catObj.lineT = 4.5;
  }
}

// Кошка отвечает на «поговорить».
function catTalk() {
  if (!catObj) return;
  catObj.line = Math.random() < 0.5 ? pick(CAT_TIPS) : pick(CAT_JUNK);
  catObj.lineT = 5;
}

/* ------------------------------- Ввод ------------------------------------ */

// Ввод собран в одном месте: клавиатура, мышь, сенсорный экран и геймпад
// переводятся в одни и те же действия. Так игра одинаково работает на
// ноутбуке, телефоне и приставке.

const keys = new Set();
const mouse = { x: -1, y: -1, clicked: false };
let lastTouchAt = 0;

// Чем сейчас пользуется игрок: 'keyboard' | 'touch' | 'gamepad'.
let uiMode = IS_TOUCH ? 'touch' : 'keyboard';

let state = 'intro'; // 'intro' | 'select' | 'play' | 'faint' | 'win' | 'victory'
let menuOpen = false; // пауза
let menuSel = 0;
let helpOpen = false; // краткая инструкция поверх игры
let selectedSlot = 0; // слот, выбранный геймпадом (LB / RB)
let introTime = 0;

const toast = { text: '', color: '#f4e9c8', t: 0 };

function showToast(text, color) {
  toast.text = text;
  toast.color = color || '#f4e9c8';
  toast.t = 2.6;
}

function updateToast(dt) {
  if (toast.t > 0) toast.t = Math.max(0, toast.t - dt);
}

function setInputMode(mode) {
  if (mode !== 'keyboard' && mode !== 'touch' && mode !== 'gamepad') return;
  if (uiMode === mode) return;
  uiMode = mode;
  if (mode !== 'touch') {
    resetJoystick();
    touchHeld.clear();
  }
}

// --- Общие действия (их вызывают клавиши, кнопки телефона и геймпада) ------

function dispatchAction(action) {
  if (helpOpen) {
    if (action === 'confirm' || action === 'back' || action === 'help' || action === 'menu') closeHelp();
    return;
  }
  if (menuOpen) {
    handleMenuAction(action);
    return;
  }
  if (state === 'intro') {
    if (action === 'confirm' || action === 'back') goToSelect();
    return;
  }
  if (state === 'select') {
    handleSelectAction(action);
    return;
  }
  if (state === 'faint') {
    if (action === 'confirm') startGame();
    else if (action === 'back') state = 'select';
    return;
  }
  if (state === 'win') {
    if (action === 'confirm') backToCity();
    else if (action === 'restart') startGame();
    else if (action === 'back') state = 'select';
    return;
  }
  if (state === 'victory') {
    if (action === 'confirm' || action === 'back') closeVictory();
    return;
  }

  // Дальше — только игра.
  if (action === 'help') {
    openHelp();
    return;
  }
  if (action === 'menu') {
    if (!dialog && !craftOpen && !shopOpen && !sleep.active) openMenu();
    return;
  }
  if (sleep.active) return; // во сне управление выключено

  if (dialog) {
    if (action === 'confirm') advanceDialog();
    else if (action === 'back') closeDialog();
    return;
  }
  if (shopOpen) {
    handleShopAction(action);
    return;
  }
  if (craftOpen) {
    handleCraftAction(action);
    return;
  }

  switch (action) {
    case 'back':
      openMenu();
      break;
    case 'confirm':
      // Рядом есть что собрать — собираем, иначе стреляем (как раньше с E).
      if (nearObj) interact();
      else shoot(false);
      break;
    case 'interact':
      if (nearObj) interact();
      break;
    case 'shoot':
      shoot(false);
      break;
    case 'craft':
      toggleCraft();
      break;
    case 'use':
      useSelectedSlot();
      break;
    case 'slotPrev':
      cycleSlot(-1);
      break;
    case 'slotNext':
      cycleSlot(1);
      break;
    default:
      break;
  }
}

function handleSelectAction(action) {
  if (action === 'left') selChar = (selChar + CHARACTERS.length - 1) % CHARACTERS.length;
  else if (action === 'right') selChar = (selChar + 1) % CHARACTERS.length;
  else if (action === 'down') selEye = (selEye + 1) % EYE_COLORS.length;
  else if (action === 'up') selEye = (selEye + EYE_COLORS.length - 1) % EYE_COLORS.length;
  else if (action === 'confirm') startGame();
  else if (action === 'back') state = 'intro';
  else if (action === 'help') openHelp();
}

function handleCraftAction(action) {
  if (action === 'back' || action === 'craft') {
    craftOpen = false;
    mouse.clicked = false;
    return;
  }
  if (action === 'up' || action === 'left') {
    craftSel = (craftSel + RECIPES.length - 1) % RECIPES.length;
  } else if (action === 'down' || action === 'right') {
    craftSel = (craftSel + 1) % RECIPES.length;
  } else if (action === 'confirm') {
    craft(RECIPES[craftSel]);
  }
}

function handleShopAction(action) {
  const last = CLOTHES.length - 1;
  if (action === 'back' || action === 'craft') {
    shopOpen = false;
    mouse.clicked = false;
    return;
  }
  if (action === 'left') shopSel = Math.max(0, shopSel - 1);
  else if (action === 'right') shopSel = Math.min(last, shopSel + 1);
  else if (action === 'up') shopSel = Math.max(0, shopSel - 2);
  else if (action === 'down') shopSel = Math.min(last, shopSel + 2);
  else if (action === 'confirm') shopClick(CLOTHES[shopSel]);
}

function handleMenuAction(action) {
  const items = menuItems();
  if (!items.length) return;
  menuSel = clamp(menuSel, 0, items.length - 1);
  if (action === 'up' || action === 'left') menuSel = (menuSel + items.length - 1) % items.length;
  else if (action === 'down' || action === 'right') menuSel = (menuSel + 1) % items.length;
  else if (action === 'confirm') menuActivate(items[menuSel].id);
  else if (action === 'back' || action === 'menu') closeMenu();
  else if (action === 'help') openHelp();
}

function goToSelect() {
  state = 'select';
  mouse.clicked = false;
}

function openMenu() {
  if (state !== 'play' || sleep.active) return;
  menuOpen = true;
  helpOpen = false;
  menuSel = 0;
  keys.clear();
  resetJoystick();
  player.moving = false;
  mouse.clicked = false;
}

function closeMenu() {
  menuOpen = false;
  keys.clear();
  resetJoystick();
  mouse.clicked = false;
  player.moving = false;
}

function openHelp() {
  if (state !== 'play' && state !== 'select') return;
  helpOpen = true;
  keys.clear();
  resetJoystick();
  player.moving = false;
  mouse.clicked = false;
}

function closeHelp() {
  helpOpen = false;
  mouse.clicked = false;
  player.moving = false;
}

function toggleCraft() {
  if (craftOpen) {
    craftOpen = false;
    mouse.clicked = false;
    return;
  }
  if (boss.active) {
    say('Не до крафта — бой идёт!', '#ff9a8a');
    return;
  }
  craftOpen = true;
  shopOpen = false;
  craftSel = 0;
  keys.clear();
  resetJoystick();
  mouse.clicked = false;
}

function cycleSlot(dir) {
  selectedSlot = (selectedSlot + dir + INV_SLOTS) % INV_SLOTS;
  if (!inventory[selectedSlot]) {
    showToast('Слот ' + (selectedSlot === 9 ? 0 : selectedSlot + 1) + ' пуст', '#9dbfa4');
  }
}

function useSelectedSlot() {
  if (!inventory[selectedSlot]) {
    showToast('Слот пуст — выбери другой (LB / RB)', '#9dbfa4');
    return;
  }
  useSlot(selectedSlot);
}

// --- Клавиатура -----------------------------------------------------------

const KEY_ACTIONS = {
  Escape: 'back',
  Enter: 'confirm',
  Space: 'confirm',
  KeyE: 'confirm',
  KeyF: 'shoot',
  KeyC: 'craft',
  KeyH: 'help',
  KeyM: 'menu',
  KeyR: 'restart',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyW: 'up',
  KeyS: 'down',
};

const REPEATABLE_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyF',
]);

function handleDigit(code) {
  const d = Number(code.slice(5)); // Digit0…Digit9 → 0…9
  if (state === 'select') {
    if (d >= 1 && d <= 5) selEye = d - 1;
    return;
  }
  if (state !== 'play' || menuOpen || helpOpen || dialog || craftOpen || shopOpen || sleep.active) {
    return;
  }
  const slot = d === 0 ? 9 : d - 1;
  selectedSlot = slot;
  useSlot(slot);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  setInputMode('keyboard');
  if (e.repeat && !REPEATABLE_KEYS.has(e.code)) return;
  if (/^Digit[0-9]$/.test(e.code)) {
    handleDigit(e.code);
    return;
  }
  const action = KEY_ACTIONS[e.code];
  if (action) dispatchAction(action);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  resetJoystick();
  touchHeld.clear();
  touchTaps.clear();
  pad.fireHeld = false;
  mouse.clicked = false;
});
try {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      keys.clear();
      resetJoystick();
      touchHeld.clear();
      touchTaps.clear();
      pad.fireHeld = false;
      mouse.clicked = false;
    }
  });
} catch (e) {
  /* без visibilitychange игра тоже работает */
}

// --- Геймпад --------------------------------------------------------------

const pad = {
  connected: false,
  index: -1,
  id: '',
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  aimActive: false,
  fireHeld: false,
  prev: [],
  navDir: null,
  navTimer: 0,
};

const PAD_DEADZONE = 0.22;
const PAD_AIM_DEADZONE = 0.35;

function padDeadzone(v) {
  const a = Math.abs(v);
  if (a <= PAD_DEADZONE) return 0;
  const k = (a - PAD_DEADZONE) / (1 - PAD_DEADZONE);
  return Math.min(1, k) * (v < 0 ? -1 : 1);
}

function resetPad() {
  pad.connected = false;
  pad.index = -1;
  pad.moveX = 0;
  pad.moveY = 0;
  pad.aimX = 0;
  pad.aimY = 0;
  pad.aimActive = false;
  pad.fireHeld = false;
  pad.prev = [];
  pad.navDir = null;
}

function pollGamepad(dt) {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) {
    if (pad.connected) {
      resetPad();
      setInputMode(IS_TOUCH ? 'touch' : 'keyboard');
    }
    return;
  }

  let gp = null;
  try {
    const list = navigator.getGamepads() || [];
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].connected) {
        gp = list[i];
        break;
      }
    }
  } catch (e) {
    gp = null;
  }

  if (!gp) {
    if (pad.connected) {
      resetPad();
      setInputMode(IS_TOUCH ? 'touch' : 'keyboard');
      showToast('Геймпад отключён', '#ffd08a');
    }
    return;
  }

  const isNew = !pad.connected || pad.index !== gp.index;
  pad.connected = true;
  pad.index = gp.index;
  pad.id = gp.id || '';
  if (isNew) {
    setInputMode('gamepad');
    showToast('Геймпад подключён: A — действие, X — выстрел', '#a6e07a');
  }

  const buttons = gp.buttons || [];
  const now = [];
  for (let i = 0; i < 16; i++) {
    const b = buttons[i];
    now[i] = !!(b && (b.pressed || b.value > 0.5));
  }
  const just = (i) => !!now[i] && !pad.prev[i];

  // Если геймпадом только что воспользовались, возвращаем подсказки геймпада.
  const axesNow = gp.axes || [];
  const active =
    now.some(Boolean) ||
    Math.abs(Number(axesNow[0]) || 0) > 0.3 ||
    Math.abs(Number(axesNow[1]) || 0) > 0.3 ||
    Math.abs(Number(axesNow[2]) || 0) > 0.3 ||
    Math.abs(Number(axesNow[3]) || 0) > 0.3;
  if (active && uiMode !== 'gamepad') setInputMode('gamepad');

  // Кнопки меню и действий. A/B/Y/LB/RB работают во всех экранах.
  if (just(9)) {
    if (helpOpen) dispatchAction('back');
    else if (!menuOpen && ['intro', 'select', 'faint', 'win', 'victory'].includes(state)) {
      dispatchAction('confirm');
    } else {
      dispatchAction('menu');
    }
  }
  if (just(8)) dispatchAction('help');
  if (just(0)) dispatchAction('confirm');
  if (just(1)) dispatchAction('back');
  if (just(3)) dispatchAction('use');
  if (just(4)) dispatchAction('slotPrev');
  if (just(5)) dispatchAction('slotNext');
  if (just(6)) dispatchAction('craft');
  if (just(2) && state === 'win') dispatchAction('restart');

  const axes = gp.axes || [];
  const ax = Number(axes[0]) || 0;
  const ay = Number(axes[1]) || 0;
  const rx = Number(axes[2]) || 0;
  const ry = Number(axes[3]) || 0;

  const up = now[12] || ay < -0.55;
  const down = now[13] || ay > 0.55;
  const left = now[14] || ax < -0.55;
  const right = now[15] || ax > 0.55;

  // Навигация по меню: крестовина/стик с автоповтором.
  let nav = null;
  if (left && !right) nav = 'left';
  else if (right && !left) nav = 'right';
  else if (up && !down) nav = 'up';
  else if (down && !up) nav = 'down';
  if (nav && nav !== pad.navDir) {
    pad.navDir = nav;
    pad.navTimer = 0.42;
    dispatchAction(nav);
  } else if (nav && pad.navDir === nav) {
    pad.navTimer -= dt;
    if (pad.navTimer <= 0) {
      pad.navTimer = 0.16;
      dispatchAction(nav);
    }
  } else {
    pad.navDir = null;
  }

  let mx = padDeadzone(ax);
  let my = padDeadzone(ay);
  if (now[14]) mx = -1;
  if (now[15]) mx = 1;
  if (now[12]) my = -1;
  if (now[13]) my = 1;
  const mlen = Math.hypot(mx, my);
  if (mlen > 1) {
    mx /= mlen;
    my /= mlen;
  }
  pad.moveX = mx;
  pad.moveY = my;

  const aimLen = Math.hypot(rx, ry);
  pad.aimActive = aimLen > PAD_AIM_DEADZONE;
  if (pad.aimActive) {
    pad.aimX = rx / aimLen;
    pad.aimY = ry / aimLen;
  }

  // Стрельба: X или RT, можно держать. В меню и диалогах не стреляем.
  const firePressed = !!now[2] || !!now[7];
  pad.fireHeld = firePressed && state === 'play' && !hasBlockingModal();

  pad.prev = now;
}

// --- Телефон и планшет ----------------------------------------------------

const TOUCH_JOY = { cx: 106, cy: 492, r: 60, knob: 28 };

const TOUCH_BUTTONS = [
  { id: 'shoot', shape: 'circle', x: VIEW_W - 76, y: 528, r: 52, label: 'ОГОНЬ', font: 22 },
  { id: 'interact', shape: 'rect', x: VIEW_W - 260, y: 432, w: 122, h: 62, label: 'ДЕЙСТВИЕ', font: 17 },
  { id: 'craft', shape: 'rect', x: VIEW_W - 132, y: 368, w: 108, h: 50, label: 'КРАФТ', font: 18 },
  { id: 'menu', shape: 'circle', x: VIEW_W - 32, y: 96, r: 22, label: '?', font: 24 },
];

const touchJoy = {
  active: false,
  id: null,
  baseX: TOUCH_JOY.cx,
  baseY: TOUCH_JOY.cy,
  dx: 0,
  dy: 0,
};

const touchHeld = new Map(); // identifier → id кнопки, которую держат
const touchTaps = new Map(); // identifier → начатая «тыкалка» по экрану
const touchFlash = { id: '', t: 0 };

function resetJoystick() {
  touchJoy.active = false;
  touchJoy.id = null;
  touchJoy.baseX = TOUCH_JOY.cx;
  touchJoy.baseY = TOUCH_JOY.cy;
  touchJoy.dx = 0;
  touchJoy.dy = 0;
}

function touchPoint(t) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || VIEW_W;
  const h = rect.height || VIEW_H;
  return {
    x: ((t.clientX - rect.left) / w) * VIEW_W,
    y: ((t.clientY - rect.top) / h) * VIEW_H,
  };
}

function touchButtonAt(x, y) {
  for (const b of TOUCH_BUTTONS) {
    if (b.shape === 'circle') {
      if (Math.hypot(x - b.x, y - b.y) <= b.r + 8) return b;
    } else if (x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) {
      return b;
    }
  }
  return null;
}

function hasBlockingModal() {
  return !!(dialog || craftOpen || shopOpen || sleep.active || menuOpen || helpOpen);
}

function hasTouchControls() {
  return uiMode === 'touch' && state === 'play' && !hasBlockingModal();
}

function startJoystick(id, p) {
  touchJoy.active = true;
  touchJoy.id = id;
  touchJoy.baseX = clamp(p.x, 70, 170);
  touchJoy.baseY = clamp(p.y, 380, 515);
  touchJoy.dx = 0;
  touchJoy.dy = 0;
}

function updateJoystickTouch(p) {
  const ox = p.x - touchJoy.baseX;
  const oy = p.y - touchJoy.baseY;
  const len = Math.hypot(ox, oy);
  const r = TOUCH_JOY.r;
  const k = len > r ? r / len : 1;
  const dx = (ox * k) / r;
  const dy = (oy * k) / r;
  const m = Math.hypot(dx, dy);
  touchJoy.dx = m < 0.14 ? 0 : dx;
  touchJoy.dy = m < 0.14 ? 0 : dy;
}

function activateTouchButton(b, id) {
  touchHeld.set(id, b.id);
  touchFlash.id = b.id;
  touchFlash.t = 0.18;
  if (b.id === 'shoot') shootAim();
  else if (b.id === 'interact') dispatchAction('interact');
  else if (b.id === 'craft') toggleCraft();
  else if (b.id === 'menu') openMenu();
}

function isFireHeld() {
  if (pad.fireHeld) return true;
  for (const id of touchHeld.values()) {
    if (id === 'shoot') return true;
  }
  return false;
}

function handleTouchTap(x, y) {
  mouse.x = x;
  mouse.y = y;
  mouse.clicked = true;

  if (state === 'play' && dialog) {
    advanceDialog();
    mouse.clicked = false;
    return;
  }
  if (state === 'play' && sleep.active) {
    mouse.clicked = false;
    return;
  }
  if (state === 'play' && !craftOpen && !shopOpen && !menuOpen && !helpOpen) {
    // По HUD и часам не стреляем: это просто информационные панели.
    const onHud = (x < 280 && y < 190) || (x > 690 && y < 65);
    if (onHud && slotAt(x, y) < 0) mouse.clicked = false;
  }
}

function onTouchStart(e) {
  if (e.preventDefault) e.preventDefault();
  lastTouchAt = Date.now();
  setInputMode('touch');
  const list = e.changedTouches || [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const p = touchPoint(t);
    if (state === 'play' && !hasBlockingModal()) {
      // Левее инвентаря — джойстик; по самим слотам нужно именно нажимать.
      if (!touchJoy.active && p.x < 190 && p.y > 360) {
        startJoystick(t.identifier, p);
        continue;
      }
      const b = touchButtonAt(p.x, p.y);
      if (b) {
        activateTouchButton(b, t.identifier);
        continue;
      }
    }
    touchTaps.set(t.identifier, {
      x0: p.x,
      y0: p.y,
      x: p.x,
      y: p.y,
      moved: false,
    });
    mouse.x = p.x;
    mouse.y = p.y;
  }
}

function onTouchMove(e) {
  if (e.preventDefault) e.preventDefault();
  const list = e.changedTouches || [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const p = touchPoint(t);
    if (touchJoy.active && touchJoy.id === t.identifier) {
      updateJoystickTouch(p);
      continue;
    }
    const tap = touchTaps.get(t.identifier);
    if (tap) {
      if (Math.hypot(p.x - tap.x0, p.y - tap.y0) > 18) tap.moved = true;
      tap.x = p.x;
      tap.y = p.y;
    }
  }
}

function onTouchEnd(e) {
  if (e.preventDefault) e.preventDefault();
  const list = e.changedTouches || [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (touchJoy.active && touchJoy.id === t.identifier) resetJoystick();
    touchHeld.delete(t.identifier);
    const tap = touchTaps.get(t.identifier);
    if (tap) {
      touchTaps.delete(t.identifier);
      if (!tap.moved) handleTouchTap(tap.x, tap.y);
    }
  }
}

function onTouchCancel(e) {
  if (e.preventDefault) e.preventDefault();
  resetJoystick();
  touchHeld.clear();
  touchTaps.clear();
}

canvas.addEventListener('touchstart', onTouchStart, { passive: false });
canvas.addEventListener('touchmove', onTouchMove, { passive: false });
canvas.addEventListener('touchend', onTouchEnd, { passive: false });
canvas.addEventListener('touchcancel', onTouchCancel, { passive: false });
canvas.addEventListener('contextmenu', (e) => {
  if (e.preventDefault) e.preventDefault();
});

function updateTouchUi(dt) {
  if (touchFlash.t > 0) touchFlash.t = Math.max(0, touchFlash.t - dt);
  if (touchJoy.active && hasBlockingModal()) resetJoystick();
}

function isPortraitTouch() {
  if (!IS_TOUCH) return false;
  try {
    return window.innerHeight > window.innerWidth;
  } catch (e) {
    return false;
  }
}

// --- Мышь ----------------------------------------------------------------

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || VIEW_W;
  const h = rect.height || VIEW_H;
  return {
    x: ((e.clientX - rect.left) / w) * VIEW_W,
    y: ((e.clientY - rect.top) / h) * VIEW_H,
  };
}
canvas.addEventListener('mousemove', (e) => {
  const p = canvasPos(e);
  mouse.x = p.x;
  mouse.y = p.y;
});
canvas.addEventListener('mouseleave', () => {
  mouse.x = -1;
  mouse.y = -1;
});
canvas.addEventListener('click', (e) => {
  // На телефоне после касания браузер иногда присылает ещё и click — его не слушаем.
  if (Date.now() - lastTouchAt < 700) return;
  setInputMode('keyboard');
  const p = canvasPos(e);
  mouse.x = p.x;
  mouse.y = p.y;
  mouse.clicked = true;
});

// --- Движение и прицеливание ----------------------------------------------

function getMoveVector() {
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (touchJoy.active) {
    x += touchJoy.dx;
    y += touchJoy.dy;
  }
  if (pad.connected) {
    x += pad.moveX;
    y += pad.moveY;
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y, len: Math.min(1, len) };
}

// Автоприцел для телефона и геймпада: ищем ближайшую живую цель.
function findNearestTarget(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = { x: e.x, y: e.y };
    }
  }
  if (boss.active) {
    const d = Math.hypot(boss.x - player.x, boss.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = { x: boss.x, y: boss.y };
    }
  }
  return best;
}

function shootAim() {
  if (uiMode === 'gamepad' && pad.aimActive) {
    shoot(false, pad.aimX, pad.aimY);
    return;
  }
  const target = findNearestTarget(620);
  if (target) {
    shoot(false, target.x - player.x, target.y - player.y);
    return;
  }
  shoot(false);
}

// Как стрелять — зависит от того, чем играет человек.
function shootHint() {
  if (uiMode === 'touch') return 'Жми «ОГОНЬ» — герой сам прицелится';
  if (uiMode === 'gamepad') return 'Жми X или RT — правый стик прицеливается';
  return 'Стреляй мышкой или пробелом';
}

/* --------------------------- Экран выбора -------------------------------- */

let selChar = 0;
let selEye = 0;
let selTime = 0;

const CARD = { w: 200, h: 280, gap: 20, y: 108 };
CARD.x0 = (VIEW_W - (CARD.w * 4 + CARD.gap * 3)) / 2;

const SWATCH = { size: 44, gap: 18, y: 424 };
SWATCH.x0 = (VIEW_W - (SWATCH.size * 5 + SWATCH.gap * 4)) / 2;

const PLAY_BTN = { x: VIEW_W / 2 - 130, y: 508, w: 260, h: 54 };
const SELECT_HELP = { x: 14, y: 14, w: 56, h: 56 };

function cardRect(i) {
  return { x: CARD.x0 + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h };
}
function swatchRect(i) {
  return { x: SWATCH.x0 + i * (SWATCH.size + SWATCH.gap), y: SWATCH.y, w: SWATCH.size, h: SWATCH.size };
}
function hit(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/* ------------------- Краткая инструкция перед началом -------------------- */

const INTRO_BTN = { x: VIEW_W / 2 - 150, y: 512, w: 300, h: 52 };
const GUIDE_PANEL = { x: Math.round((VIEW_W - 872) / 2), y: 92, w: 872, h: 404 };

const GUIDE_STEPS = [
  'Собирай палки, листья, еду и уголь. Жми «Действие».',
  'Скрафти лук и стрелы — без них боссов не победить.',
  'Ночью приходят волки. Костёр и кровать помогают.',
  'Победи боссов и войди в ворота — там город и финал.',
];

function guideControls() {
  if (uiMode === 'touch') {
    return [
      ['Джойстик', 'ходить по лесу'],
      ['ОГОНЬ', 'стрелять, целится сам'],
      ['ДЕЙСТВИЕ', 'собрать, войти, говорить'],
      ['КРАФТ', 'лук, стрелы, кровать'],
      ['Слоты', 'нажми, чтобы съесть'],
      ['?', 'меню и помощь'],
    ];
  }
  if (uiMode === 'gamepad') {
    return [
      ['Стик / крест', 'ходить'],
      ['A', 'действие и «дальше»'],
      ['X / RT', 'стрелять, стик — прицел'],
      ['Y', 'использовать предмет'],
      ['LB / RB', 'выбрать слот'],
      ['LT', 'крафт'],
      ['Start / Back', 'меню и помощь'],
    ];
  }
  return [
    ['WASD / стрелки', 'ходить'],
    ['E / пробел', 'собрать, войти, говорить'],
    ['Мышь / F', 'стрелять'],
    ['C', 'крафт'],
    ['1–0', 'предмет из слота'],
    ['H / Esc', 'помощь и меню'],
  ];
}

function guideModeName() {
  if (uiMode === 'touch') return 'ТЕЛЕФОН';
  if (uiMode === 'gamepad') return 'ГЕЙМПАД';
  return 'КЛАВИАТУРА';
}

function drawGuidePanel() {
  const p = GUIDE_PANEL;
  const leftX = p.x + 34;
  const rightX = p.x + 476;
  const headY = p.y + 32;
  const bodySize = IS_TOUCH ? 19 : 17;
  const bodyLine = IS_TOUCH ? 24 : 21;
  const stepGap = IS_TOUCH ? 50 : 48;
  const headingSize = IS_TOUCH ? 20 : 18;

  ctx.fillStyle = 'rgba(14, 28, 19, 0.94)';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.strokeStyle = '#4a6b52';
  ctx.lineWidth = 3;
  ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);

  // тонкая разделительная линия между целью и управлением
  ctx.strokeStyle = 'rgba(74, 107, 82, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x + 452, p.y + 24);
  ctx.lineTo(p.x + 452, p.y + p.h - 58);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffdf7a';
  ctx.font = 'bold ' + headingSize + 'px "Courier New", monospace';
  ctx.fillText('ТВОЯ ЦЕЛЬ', leftX, headY);
  ctx.fillText('УПРАВЛЕНИЕ', rightX, headY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8fae96';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText(guideModeName(), p.x + p.w - 30, headY);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f4e9c8';
  ctx.font = bodySize + 'px "Courier New", monospace';
  wrapText(
    'Выжить в лесу: победить Бабу-ягу и Лешего и добраться до города.',
    leftX,
    headY + 28,
    400,
    bodyLine
  );

  ctx.fillStyle = '#ffdf7a';
  ctx.font = 'bold ' + headingSize + 'px "Courier New", monospace';
  ctx.fillText('ЧТО ДЕЛАТЬ', leftX, headY + 104);

  const actionName = uiMode === 'touch' ? '«Действие»' : uiMode === 'gamepad' ? 'A' : 'E';
  const steps = GUIDE_STEPS.slice();
  steps[0] =
    'Собирай палки, листья, еду и уголь. ' +
    (uiMode === 'touch' ? 'Жми ' + actionName + '.' : 'Подойди и жми ' + actionName + '.');
  for (let i = 0; i < steps.length; i++) {
    const y = headY + 132 + i * stepGap;
    ctx.fillStyle = '#ffdf7a';
    ctx.font = 'bold ' + bodySize + 'px "Courier New", monospace';
    ctx.fillText(String(i + 1) + '.', leftX, y);
    ctx.fillStyle = '#cfe3d2';
    ctx.font = bodySize + 'px "Courier New", monospace';
    wrapText(steps[i], leftX + 26, y, 366, bodyLine);
  }

  const controls = guideControls();
  for (let i = 0; i < controls.length; i++) {
    const y = headY + 38 + i * 34;
    ctx.fillStyle = '#ffdf7a';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText(controls[i][0] + ' —', rightX, y);
    ctx.fillStyle = '#cfe3d2';
    ctx.font = '16px "Courier New", monospace';
    wrapText(controls[i][1], rightX + 160, y, 236, 18);
  }

  ctx.fillStyle = '#8fae96';
  ctx.font = '14px "Courier New", monospace';
  const note =
    uiMode === 'touch'
      ? 'Телефон держи горизонтально — так удобнее.'
      : uiMode === 'gamepad'
        ? 'Нажми любую кнопку — геймпад уже подключён.'
        : 'Геймпад подключается сам. H — помощь в игре.';
  wrapText(note, rightX, headY + 270, 330, 19);

  // нижняя подсказка на всю ширину панели
  ctx.strokeStyle = 'rgba(74, 107, 82, 0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x + 26, p.y + p.h - 48);
  ctx.lineTo(p.x + p.w - 26, p.y + p.h - 48);
  ctx.stroke();
  ctx.fillStyle = '#9dbfa4';
  ctx.font = '14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Совет: голод не ждёт — ешь яблоки, бананы и овощи. Синее зелье лечит.',
    p.x + p.w / 2,
    p.y + p.h - 20
  );
  ctx.textAlign = 'left';
}

function drawGuideScreen(mode) {
  const isHelp = mode === 'help';
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#20402c');
  grad.addColorStop(1, '#14251b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawBackdropTrees();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 38px "Courier New", monospace';
  ctx.fillText(isHelp ? 'КАК ИГРАТЬ' : 'ЖИЗНЬ В ЛЕСУ', VIEW_W / 2, 48);
  ctx.fillStyle = '#9dbfa4';
  ctx.font = (IS_TOUCH ? 18 : 16) + 'px "Courier New", monospace';
  ctx.fillText(
    isHelp
      ? state === 'play'
        ? 'Игра на паузе — цель, шаги и управление'
        : 'Коротко о цели, шагах и управлении'
      : 'Короткая инструкция: цель, шаги и управление',
    VIEW_W / 2,
    76
  );

  drawGuidePanel();

  ctx.textAlign = 'center';
  const hovered = hit(INTRO_BTN, mouse.x, mouse.y);
  ctx.fillStyle = hovered ? '#7bbd63' : '#5d9a4c';
  ctx.fillRect(INTRO_BTN.x, INTRO_BTN.y, INTRO_BTN.w, INTRO_BTN.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f4e9c8';
  ctx.strokeRect(INTRO_BTN.x + 1.5, INTRO_BTN.y + 1.5, INTRO_BTN.w - 3, INTRO_BTN.h - 3);
  ctx.fillStyle = '#12240f';
  ctx.font = 'bold 21px "Courier New", monospace';
  ctx.fillText(
    isHelp ? 'ПРОДОЛЖИТЬ' : 'ДАЛЬШЕ',
    INTRO_BTN.x + INTRO_BTN.w / 2,
    INTRO_BTN.y + 34
  );

  ctx.fillStyle = '#7f9c86';
  ctx.font = (IS_TOUCH ? 15 : 13) + 'px "Courier New", monospace';
  ctx.fillText(
    isHelp
      ? state === 'play'
        ? 'Esc / B / H — закрыть. Игра продолжается с того же места.'
        : 'Esc / B / H — закрыть.'
      : 'Дальше — выбор героя. Играть можно с клавиатуры, телефона и геймпада.',
    VIEW_W / 2,
    584
  );
  ctx.textAlign = 'left';
}

function drawIntro() {
  drawGuideScreen('intro');
}

function drawHelpScreen() {
  drawGuideScreen('help');
}

function updateIntro(dt) {
  introTime += dt;
  if (!mouse.clicked) return;
  mouse.clicked = false;
  if (hit(INTRO_BTN, mouse.x, mouse.y)) goToSelect();
}

function updateHelp() {
  if (!mouse.clicked) return;
  mouse.clicked = false;
  if (hit(INTRO_BTN, mouse.x, mouse.y)) closeHelp();
}

function startGame() {
  world = forest; // новая жизнь начинается в лесу
  player.x = WORLD_W / 2;
  player.y = WORLD_H / 2;
  forestReturn.x = player.x;
  forestReturn.y = player.y;
  player.dir = 'down';
  player.animTime = 0;
  player.hp = MAX_HP;
  player.hunger = MAX_HUNGER;
  player.eaten = 0;
  player.defeated = 0;
  player.invuln = 0;
  player.flash = 0;
  player.poison = 0;
  floaters.length = 0;
  inventory.length = 0;
  enemies.length = 0;
  arrows.length = 0;
  bombs.length = 0;
  shootTimer = 0;
  wolfTimer = 4;
  batTimer = 3;
  craftOpen = false;
  shopOpen = false;
  dialog = null;
  menuOpen = false;
  helpOpen = false;
  selectedSlot = 0;
  craftSel = 0;
  shopSel = 0;
  sleep.active = false;
  keys.clear();
  resetJoystick();
  touchHeld.clear();
  touchTaps.clear();
  pad.fireHeld = false;
  mouse.clicked = false;
  clock.t = 0;
  clock.day = 1;
  faintReason = 'Ты обессилел от голода';

  // боссы возвращаются: огород снова закрыт, зелья в избушке на месте
  yagaDefeated = false;
  leshyDefeated = false;
  boss.id = null;
  boss.active = false;
  boss.dead = false;
  boss.deadT = 0;
  boss.hp = 0;
  boss.maxHp = 0;
  boss.hurt = 0;
  boss.lineT = 0;
  boss.phase = 1;
  catObj = null;
  potions.length = 0;
  splashes.length = 0;
  roots.length = 0;
  rootHintShown = false;
  victory = null;
  shopOpen = false;
  dialog = null;
  cityPieGiven = false;

  // поставленные костры и кровати убираем, ресурсы восстанавливаем — и в лесу, и в пещерах
  for (const zone of [forest, ...Object.values(caves)]) {
    zone.objects = zone.objects.filter(
      (o) => o.type !== 'campfire' && o.type !== 'bed' && o.type !== 'cat'
    );
    for (const o of zone.objects) {
      o.timer = 0;
      if (FOOD[o.type]) o.fruits = FOOD[o.type].max;
      if (o.type === 'bush') o.leaves = LEAF_MAX;
      if (o.type === 'coalRock' || o.type === 'caveCoal') o.charges = COAL_MAX;
      if (o.type === 'crystal') o.charges = CRYSTAL_MAX;
      if (o.type === 'stick' || o.type === 'matchbox') o.taken = false;
      if (o.type === 'yagaHouse') o.potions = HOUSE_POTIONS;
    }
  }
  state = 'play';
}

function updateSelect(dt) {
  selTime += dt;
  if (!mouse.clicked) return;
  mouse.clicked = false;
  for (let i = 0; i < CHARACTERS.length; i++) {
    if (hit(cardRect(i), mouse.x, mouse.y)) selChar = i;
  }
  for (let i = 0; i < EYE_COLORS.length; i++) {
    if (hit(swatchRect(i), mouse.x, mouse.y)) selEye = i;
  }
  if (hit(SELECT_HELP, mouse.x, mouse.y)) {
    openHelp();
    return;
  }
  if (hit(PLAY_BTN, mouse.x, mouse.y)) startGame();
}

function drawSelect() {
  // фон
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#20402c');
  grad.addColorStop(1, '#14251b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawBackdropTrees();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 40px "Courier New", monospace';
  ctx.fillText('ЖИЗНЬ В ЛЕСУ', VIEW_W / 2, 58);
  ctx.fillStyle = '#9dbfa4';
  ctx.font = '17px "Courier New", monospace';
  ctx.fillText('Выбери персонажа и цвет глаз', VIEW_W / 2, 84);

  // сколько алмазиков накоплено (их тратят в лавке в лесу)
  drawItemIcon(ctx, 'diamond', VIEW_W - 128, 16, 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#bff0ff';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(String(progress.diamonds), VIEW_W - 96, 36);
  ctx.textAlign = 'center';

  // кнопка «?» — вернуться к инструкции
  const helpHover = hit(SELECT_HELP, mouse.x, mouse.y);
  ctx.fillStyle = helpHover ? '#3b5f43' : 'rgba(12, 26, 18, 0.7)';
  ctx.fillRect(SELECT_HELP.x, SELECT_HELP.y, SELECT_HELP.w, SELECT_HELP.h);
  ctx.strokeStyle = helpHover ? '#f4e9c8' : '#4a6b52';
  ctx.lineWidth = 2;
  ctx.strokeRect(SELECT_HELP.x + 1, SELECT_HELP.y + 1, SELECT_HELP.w - 2, SELECT_HELP.h - 2);
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.fillText('?', SELECT_HELP.x + SELECT_HELP.w / 2, SELECT_HELP.y + 39);

  // карточки персонажей
  for (let i = 0; i < CHARACTERS.length; i++) {
    const r = cardRect(i);
    const def = CHARACTERS[i];
    const active = i === selChar;
    const hovered = hit(r, mouse.x, mouse.y);

    ctx.fillStyle = active ? '#3b5f43' : hovered ? '#2c4733' : '#25382b';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = active ? 4 : 2;
    ctx.strokeStyle = active ? '#f4e9c8' : '#4a6b52';
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

    // «полянка» под персонажем
    ctx.fillStyle = '#2f5d3a';
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, r.y + 176, 52, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = active ? Math.sin(selTime * 4) * 3 : 0;
    const frame = active ? (Math.floor(selTime * 6) % 4 === 1 ? 1 : Math.floor(selTime * 6) % 4 === 3 ? 2 : 0) : 0;
    drawCharacter(ctx, r.x + r.w / 2, r.y + 176 + bob, 6, def, EYE_COLORS[selEye].color, 'down', frame);

    ctx.fillStyle = active ? '#f4e9c8' : '#cfe3d2';
    ctx.font = 'bold ' + (IS_TOUCH ? 17 : 16) + 'px "Courier New", monospace';
    wrapText(def.name, r.x + r.w / 2, r.y + 210, r.w - 16, 18);
    ctx.fillStyle = '#8fae96';
    ctx.font = (IS_TOUCH ? 14 : 13) + 'px "Courier New", monospace';
    def.desc.forEach((line, k) => ctx.fillText(line, r.x + r.w / 2, r.y + 242 + k * 16));

    ctx.fillStyle = '#6f8f77';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(String(i + 1), r.x + 14, r.y + 20);
  }

  // выбор цвета глаз
  ctx.fillStyle = '#cfe3d2';
  ctx.font = (IS_TOUCH ? 17 : 16) + 'px "Courier New", monospace';
  ctx.fillText('Цвет глаз: ' + EYE_COLORS[selEye].name, VIEW_W / 2, SWATCH.y - 14);
  for (let i = 0; i < EYE_COLORS.length; i++) {
    const r = swatchRect(i);
    const active = i === selEye;
    ctx.fillStyle = '#1c2c21';
    ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    ctx.fillStyle = EYE_COLORS[i].color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // «зрачок и блик», чтобы кнопка была похожа на глаз
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(r.x + r.w / 2 - 5, r.y + r.h / 2 - 5, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(r.x + r.w / 2 + 2, r.y + r.h / 2 - 8, 4, 4);
    ctx.lineWidth = active ? 4 : hit(r, mouse.x, mouse.y) ? 3 : 2;
    ctx.strokeStyle = active ? '#f4e9c8' : '#4a6b52';
    ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
  }

  // кнопка «Играть»
  const btnHover = hit(PLAY_BTN, mouse.x, mouse.y);
  ctx.fillStyle = btnHover ? '#7bbd63' : '#5d9a4c';
  ctx.fillRect(PLAY_BTN.x, PLAY_BTN.y, PLAY_BTN.w, PLAY_BTN.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f4e9c8';
  ctx.strokeRect(PLAY_BTN.x + 1.5, PLAY_BTN.y + 1.5, PLAY_BTN.w - 3, PLAY_BTN.h - 3);
  ctx.fillStyle = '#12240f';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText('В ЛЕС!', PLAY_BTN.x + PLAY_BTN.w / 2, PLAY_BTN.y + 36);

  ctx.fillStyle = '#7f9c86';
  ctx.font = (IS_TOUCH ? 15 : 13) + 'px "Courier New", monospace';
  ctx.fillText(
    uiMode === 'touch'
      ? 'Нажми на героя, выбери глаза и жми «В ЛЕС!» · ? — помощь'
      : uiMode === 'gamepad'
        ? 'Стик / крест — выбор · A — начать · Back — помощь'
        : 'мышка или: ← → персонаж, ↑ ↓ (1–5) глаза, Enter — начать · H — помощь',
    VIEW_W / 2,
    VIEW_H - 14
  );
}

// Декоративные ёлки по краям экрана выбора.
function drawBackdropTrees() {
  const rnd = mulberry32(7);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * VIEW_W;
    const y = 30 + rnd() * VIEW_H;
    const s = 0.5 + rnd() * 0.7;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#0f2016';
    ctx.fillRect(x - 3 * s, y, 6 * s, 26 * s);
    ctx.beginPath();
    ctx.arc(x, y - 6 * s, 26 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let ly = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, ly);
      line = w;
      ly += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, ly);
}

/* ------------------------------ Игра ------------------------------------- */

function updatePlay(dt) {
  clock.t += dt;
  if (clock.t >= DAY_LEN) {
    clock.t -= DAY_LEN;
    clock.day++;
  }

  if (dialog) {
    dialog.t += dt;
    player.moving = false;
    mouse.clicked = false;
    return;
  }

  if (sleep.active) {
    updateSleep(dt);
    updateFloaters(dt);
    mouse.clicked = false;
    return;
  }

  if (craftOpen) {
    updateCraftPanel();
    updateSurvival(dt);
    updateFoodGrowth(dt);
    updateResources(dt);
    updateFloaters(dt);
    player.moving = false;
    mouse.clicked = false;
    return;
  }

  if (shopOpen) {
    updateShop();
    updateSurvival(dt);
    updateFloaters(dt);
    player.moving = false;
    mouse.clicked = false;
    return;
  }

  const move = getMoveVector();
  player.moving = move.len > 0.08;
  if (player.moving) {
    const len = Math.hypot(move.x, move.y) || 1;
    const dx = move.x / len;
    const dy = move.y / len;
    // направление взгляда: приоритет у того, что сильнее нажато
    if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
    else player.dir = dy > 0 ? 'down' : 'up';

    const dist = player.speed * dt * move.len;
    moveAxis(dx * dist, 0);
    moveAxis(0, dy * dist);
    player.animTime += dt;
  } else {
    player.animTime = 0;
  }

  // камера следует за игроком и не выходит за края карты
  camera.x = clamp(player.x - VIEW_W / 2, 0, Math.max(0, world.w - VIEW_W));
  camera.y = clamp(player.y - VIEW_H / 2, 0, Math.max(0, world.h - VIEW_H));

  if (player.invuln > 0) player.invuln -= dt;
  if (player.flash > 0) player.flash -= dt;
  if (shootTimer > 0) shootTimer -= dt;

  updateSurvival(dt);
  updateFoodGrowth(dt);
  updateResources(dt);
  updateSpawning(dt);
  updateEnemies(dt);
  updateArrows(dt);
  updateBombs(dt);
  updateBosses(dt);
  updateFloaters(dt);
  nearObj = findInteractable();

  // На телефоне и геймпаде кнопку огня можно держать: стрелы летят с кулдауном.
  if (isFireHeld()) shootAim();

  if (mouse.clicked) {
    const slot = slotAt(mouse.x, mouse.y);
    if (slot >= 0) {
      selectedSlot = slot;
      useSlot(slot); // клик по инвентарю — использовать предмет
    } else if (hasBow()) {
      shoot(true); // с луком клик по карте — выстрел в сторону курсора
    } else if (nearObj) {
      interact(); // без лука клик просто собирает то, что рядом
    }
  }
  mouse.clicked = false;
}

function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].t += dt;
    if (floaters[i].t > 1.4) floaters.splice(i, 1);
  }
}

// Сон: экран плавно темнеет, время перескакивает на утро, персонаж отдыхает.
function updateSleep(dt) {
  sleep.t += dt;
  if (!sleep.done && sleep.t >= 1.2) {
    sleep.done = true;
    clock.day++;
    clock.t = 0; // просыпаемся в начале дня
    player.hp = Math.min(MAX_HP, player.hp + 15);
    player.hunger = Math.max(0, player.hunger - 12); // за ночь успеваешь проголодаться
  }
  if (sleep.t >= 2.6) {
    sleep.active = false;
    say('Доброе утро! День ' + clock.day, '#ffdf7a');
  }
}

// Сорванное и подобранное появляется снова через время.
function updateResources(dt) {
  for (const o of world.objects) {
    if (o.type === 'bush') {
      if (o.leaves >= LEAF_MAX) continue;
      o.timer += dt;
      if (o.timer >= LEAF_REGROW) {
        o.timer = 0;
        o.leaves++;
      }
    } else if (o.type === 'coalRock' || o.type === 'caveCoal') {
      if (o.charges >= COAL_MAX) continue;
      o.timer += dt;
      if (o.timer >= COAL_REGROW) {
        o.timer = 0;
        o.charges++;
      }
    } else if (o.type === 'crystal') {
      if (o.charges >= CRYSTAL_MAX) continue;
      o.timer += dt;
      if (o.timer >= CRYSTAL_REGROW) {
        o.timer = 0;
        o.charges++;
      }
    } else if (o.type === 'stick' || o.type === 'matchbox') {
      if (!o.taken) continue;
      o.timer += dt;
      if (o.timer >= (o.type === 'stick' ? STICK_REGROW : MATCH_REGROW)) {
        o.timer = 0;
        o.taken = false;
      }
    }
  }
}

// Голод, голодный урон и медленное восстановление здоровья у сытого персонажа.
function updateSurvival(dt) {
  // яд из зелёного зелья: −1 HP каждую секунду
  if (player.poison > 0) {
    player.poison = Math.max(0, player.poison - dt);
    player.hp -= dt;
    if (player.hp <= 0) {
      player.hp = 0;
      faintReason = 'Зелёное зелье оказалось ядом';
      state = 'faint';
      return;
    }
  }

  player.hunger = Math.max(0, player.hunger - HUNGER_PER_SEC * dt);
  if (player.hunger <= 0) {
    player.hp -= STARVE_DAMAGE * dt;
    if (player.hp <= 0) {
      player.hp = 0;
      faintReason = 'Ты обессилел от голода';
      state = 'faint';
    }
  } else if (player.hunger > 70 && player.hp < MAX_HP) {
    player.hp = Math.min(MAX_HP, player.hp + HEAL_PER_SEC * dt);
  }

  // у костра тепло: здоровье восстанавливается быстрее
  if (player.hunger > 0 && player.hp < MAX_HP && nearCampfire()) {
    player.hp = Math.min(MAX_HP, player.hp + HEAL_PER_SEC * 2 * dt);
  }
}

function nearCampfire() {
  return world.objects.some(
    (o) => o.type === 'campfire' && Math.hypot(o.x - player.x, o.y - player.y) < 70
  );
}

// Сорванные плоды вырастают заново через время.
function updateFoodGrowth(dt) {
  for (const o of world.objects) {
    const cfg = FOOD[o.type];
    if (!cfg || o.fruits >= cfg.max) continue;
    o.timer += dt;
    if (o.timer >= cfg.regrow) {
      o.timer = 0;
      o.fruits++;
    }
  }
}

/* --------------------------- Взаимодействие ------------------------------- */

// Что можно сделать с объектом прямо сейчас (или null, если ничего).
// locked: true — подсказка есть, но действие пока недоступно.
function interactInfo(o) {
  if (o.type === 'yagaHouse') {
    if (!yagaDefeated) return { text: 'постучать в избушку', top: o.y - 128 };
    if (o.potions > 0) return { text: 'взять зелье из избушки', top: o.y - 128 };
    return { text: 'избушка опустела', top: o.y - 128, locked: true };
  }
  if (o.type === 'carrotPatch' && !yagaDefeated) {
    return { text: 'огород закрыт: победи Бабу-ягу', top: o.y - 36, locked: true };
  }
  if (o.type === 'forestExit') {
    if (leshyDefeated) return { text: 'войти в город', top: o.y - 130 };
    return { text: 'выход охраняет Леший', top: o.y - 130, locked: true };
  }
  if (o.type === 'cityGate') return { text: 'вернуться в лес', top: o.y - 128 };
  if (o.type === 'npc' || o.type === 'dog') return { text: 'поговорить: ' + o.name, top: o.y - 64 };
  if (o.type === 'sign') return { text: 'прочитать указатель', top: o.y - 118 };
  if (o.type === 'cat') return { text: 'поговорить с кошкой', top: o.y - 30 };
  if (o.type === 'shopCart') {
    return { text: 'заглянуть в лавку одежды', top: o.y - 150 };
  }
  if (FOOD[o.type] && o.fruits > 0) {
    const label = o.type === 'vegetable' ? o.veg.name : FOOD[o.type].food;
    const top =
      o.type === 'vegetable'
        ? o.y - 26
        : o.type === 'carrotPatch'
          ? o.y - 46
          : o.y - o.h - 6 - o.crown - 14;
    return { text: 'сорвать: ' + label, top };
  }
  if (o.type === 'bush' && o.leaves > 0) return { text: 'набрать листьев', top: o.y - 30 };
  if (o.type === 'stick' && !o.taken) return { text: 'подобрать палку', top: o.y - 14 };
  if (o.type === 'coalRock' && o.charges > 0) return { text: 'добыть уголь', top: o.y - o.w * 0.7 - 8 };
  if (o.type === 'matchbox' && !o.taken) return { text: 'взять спички', top: o.y - 16 };
  if (o.type === 'bed') return { text: isNight() ? 'лечь спать' : 'спать можно ночью', top: o.y - 26 };
  if (o.type === 'caveEntry') return { text: 'войти в пещеру №' + o.level, top: o.y - 60 };
  if (o.type === 'caveExit') return { text: 'выйти из пещеры', top: o.y - 56 };
  if (o.type === 'caveCoal' && o.charges > 0) return { text: 'добыть уголь', top: o.y - o.w * 0.7 - 8 };
  if (o.type === 'crystal' && o.charges > 0) return { text: 'добыть кристалл', top: o.y - 34 };
  if (o.type === 'campfire' && invCount('meat') > 0) return { text: 'пожарить мясо', top: o.y - 36 };
  return null;
}

// Ближайший объект в пределах вытянутой руки, с которым есть что делать.
function findInteractable() {
  let best = null;
  let bestDist = Infinity;
  for (const o of world.objects) {
    if (!interactInfo(o)) continue;
    const reach = Math.max(52, (o.hitR || 0) + 40); // к избушке и воротам нужно подойти ближе
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d > reach) continue;
    if (d < bestDist) {
      bestDist = d;
      best = o;
    }
  }
  return best;
}

// Нажали E: собрать ресурс, поговорить, войти в избушку или лечь спать.
function interact() {
  const o = nearObj;
  if (!o) return;

  if (o.type === 'yagaHouse') {
    if (!yagaDefeated) {
      if (boss.active) return; // бой уже идёт
      startBossFight('yaga');
      return;
    }
    if (o.potions > 0) takeHousePotion(o);
    else say('В избушке больше ничего нет', '#cfe3d2');
  } else if (o.type === 'forestExit') {
    if (leshyDefeated) {
      enterCity();
      return;
    }
    say('Ворота заперты: Леший не пускает', '#ff9a8a');
  } else if (o.type === 'cityGate') {
    exitCity();
    return;
  } else if (o.type === 'npc' || o.type === 'sign' || o.type === 'dog') {
    startDialog(o);
    return;
  } else if (o.type === 'cat') {
    catTalk();
  } else if (o.type === 'shopCart') {
    shopOpen = true;
    shopSel = 0;
    craftOpen = false;
    mouse.clicked = false;
    nearObj = findInteractable();
    return;
  } else if (FOOD[o.type] && o.fruits > 0) {
    if (o.type === 'carrotPatch' && !yagaDefeated) {
      say('Огород закрыт: сначала победи Бабу-ягу', '#ff9a8a');
    } else {
      const cfg = FOOD[o.type];
      if (!pickUp(cfg.item)) return;
      o.fruits--;
    }
  } else if (o.type === 'bush' && o.leaves > 0) {
    if (!pickUp('leaf')) return;
    o.leaves--;
    o.timer = 0;
  } else if ((o.type === 'coalRock' || o.type === 'caveCoal') && o.charges > 0) {
    if (!pickUp('coal')) return;
    o.charges--;
    o.timer = 0;
  } else if (o.type === 'crystal' && o.charges > 0) {
    if (!pickUp('crystal')) return;
    o.charges--;
    o.timer = 0;
  } else if ((o.type === 'stick' || o.type === 'matchbox') && !o.taken) {
    if (!pickUp(o.type === 'stick' ? 'stick' : 'match')) return;
    o.taken = true;
    o.timer = 0;
  } else if (o.type === 'bed') {
    goToSleep();
  } else if (o.type === 'caveEntry') {
    enterCave(o.level);
    return;
  } else if (o.type === 'caveExit') {
    exitCave();
    return;
  } else if (o.type === 'campfire' && invCount('meat') > 0) {
    cookMeat();
  }
  nearObj = findInteractable();
}

// Зелья из избушки: синее лечит, зелёное травит.
function takeHousePotion(o) {
  const blue = Math.random() < 0.6;
  const id = blue ? 'potionBlue' : 'potionGreen';
  if (!addItem(id)) {
    say('Инвентарь полон', '#ff9a8a');
    return;
  }
  o.potions--;
  say('Взято: ' + ITEMS[id].name + (blue ? ' (+25 HP)' : ' (яд!)'), blue ? '#7fb8ff' : '#8fd07a');
}

// Мясо жарится на костре и становится куда сытнее.
function cookMeat() {
  if (invCount('cookedMeat') === 0 && inventory.length >= INV_SLOTS && invCount('meat') > 1) {
    say('Инвентарь полон', '#ff9a8a');
    return;
  }
  removeItem('meat');
  addItem('cookedMeat');
  say('Мясо пожарено! +' + ITEMS.cookedMeat.hunger + ' сытости', '#ffdf7a');
}

// Положить предмет в инвентарь и показать надпись.
function pickUp(id) {
  if (!addItem(id)) {
    say('Инвентарь полон', '#ff9a8a');
    return false;
  }
  say('+1 ' + ITEMS[id].name, '#ffdf7a');
  return true;
}

function goToSleep() {
  if (boss.active) {
    say('Не до сна — сначала бой!', '#ff9a8a');
    return;
  }
  if (!isNight()) {
    say('Спать хочется только ночью', '#cfe3d2');
    return;
  }
  // рядом воют волки — не до сна
  if (enemies.some((e) => Math.hypot(e.x - player.x, e.y - player.y) < 300)) {
    say('Рядом волки — сначала прогони их!', '#ff9a8a');
    return;
  }
  sleep.active = true;
  sleep.t = 0;
  sleep.done = false;
}

// Клик или цифра по слоту инвентаря: съесть, поставить или просто посмотреть.
function useSlot(i) {
  const slot = inventory[i];
  if (!slot) return;
  const item = ITEMS[slot.id];

  if (item.hunger) {
    if (player.hunger >= MAX_HUNGER) {
      say('Уже сыт', '#cfe3d2');
      return;
    }
    const before = player.hunger;
    player.hunger = Math.min(MAX_HUNGER, player.hunger + item.hunger);
    player.eaten++;
    removeItem(slot.id);
    say('+' + Math.round(player.hunger - before) + ' сытости', '#ffdf7a');
  } else if (item.heal) {
    if (player.hp >= MAX_HP) {
      say('Здоровье и так полное', '#cfe3d2');
      return;
    }
    player.hp = Math.min(MAX_HP, player.hp + item.heal);
    removeItem(slot.id);
    say('+' + item.heal + ' здоровья', '#7fb8ff');
  } else if (item.poison) {
    player.poison = item.poison;
    removeItem(slot.id);
    say('Зелье обжигает! Яд на ' + item.poison + ' секунд', '#8fd07a');
  } else if (item.place) {
    placeItem(slot.id);
  } else if (item.throwable) {
    throwBomb();
  } else if (slot.id === 'bow' || slot.id === 'crystalBow') {
    say(invCount('arrow') ? shootHint() : 'Нужны стрелы — скрафти их (C)', '#cfe3d2');
  } else if (slot.id === 'arrow') {
    say('Стрелы летят из лука: ' + shootHint().toLowerCase(), '#cfe3d2');
  } else {
    say(item.name + ' — пригодится позже', '#cfe3d2');
  }
}

// Поставить костёр или кровать перед персонажем.
function placeItem(id) {
  const off = { down: [0, 26], up: [0, -18], left: [-26, 4], right: [26, 4] }[player.dir];
  const x = clamp(player.x + off[0], 24, world.w - 24);
  const y = clamp(player.y + off[1], 40, world.h - 24);
  const busy = world.objects.some((o) => {
    const rad = o.hitR || (o.type === 'campfire' || o.type === 'bed' ? 20 : 0);
    return rad && Math.hypot(o.x - x, o.y - y) < rad + 14;
  });
  const p = world.pond;
  const inWater = p && ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 < 1;
  if (busy || inWater) {
    say('Здесь не поставить', '#ff9a8a');
    return;
  }
  removeItem(id);
  world.objects.push({ type: id, x, y, r: 12, seed: Math.random() });
  say(ITEMS[id].name + ' поставлен' + (id === 'bed' ? 'а' : ''), '#a6e07a');
  nearObj = findInteractable();
}

// Двигаем по одной оси и откатываем, если упёрлись в дерево/камень.
function moveAxis(dx, dy) {
  const nx = clamp(player.x + dx, 16, world.w - 16);
  const ny = clamp(player.y + dy, 26, world.h - 16);
  // если игрок каким-то образом оказался внутри препятствия — даём ему выйти
  if (!collides(nx, ny) || collides(player.x, player.y)) {
    player.x = nx;
    player.y = ny;
  }
}

function collides(x, y) {
  const p = world.pond; // в пещере озера нет
  if (p && ((x - p.x) / p.rx) ** 2 + ((y - p.y) / p.ry) ** 2 < 1) return true;
  for (const o of world.objects) {
    if (o.box) {
      // дома и лавки — прямоугольные
      if (
        x > o.box.x0 - player.r &&
        x < o.box.x1 + player.r &&
        y > o.box.y0 - player.r &&
        y < o.box.y1 + player.r
      ) {
        return true;
      }
      continue;
    }
    if (!o.hitR) continue; // сквозь кусты, грибы и грядки можно проходить
    if (Math.abs(o.x - x) > o.hitR + player.r || Math.abs(o.y - y) > o.hitR + player.r) continue;
    if (Math.hypot(o.x - x, o.y - y) < o.hitR + player.r) return true;
  }
  return false;
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function drawPlay() {
  ctx.fillStyle = world.kind === 'cave' ? '#2a2630' : '#3a6b42';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

  drawGround();
  drawRoots(); // круги и корни Лешего — на земле, под всеми

  // всё, что на земле, рисуем по глубине (кто ниже — тот спереди)
  const drawables = [];
  for (const o of world.objects) {
    if (o.x < camera.x - 80 || o.x > camera.x + VIEW_W + 80) continue;
    if (o.y < camera.y - 140 || o.y > camera.y + VIEW_H + 80) continue;
    drawables.push(o);
  }
  for (const e of enemies) drawables.push({ type: 'enemy', x: e.x, y: e.y, e });
  for (const b of bombs) drawables.push({ type: 'bomb', x: b.x, y: b.y, b });
  // Леший стоит на посту у ворот, даже пока бой не начался (только в лесу)
  if (world.kind === 'forest') {
    if (boss.id === 'leshy') drawables.push({ type: 'bossLeshy', x: boss.x, y: boss.y });
    else if (!leshyDefeated) drawables.push({ type: 'bossLeshy', x: LESHY_HOME.x, y: LESHY_HOME.y });
    if (boss.id === 'yaga') drawables.push({ type: 'bossYaga', x: boss.x, y: boss.y });
  }
  drawables.push({ type: 'player', x: player.x, y: player.y });
  drawables.sort((a, b) => a.y - b.y);

  for (const o of drawables) {
    switch (o.type) {
      case 'caveEntry': drawCaveEntry(o); break;
      case 'caveExit': drawCaveExit(o); break;
      case 'caveRock': drawCaveRock(o); break;
      case 'stalagmite': drawStalagmite(o); break;
      case 'caveCoal': drawCoalRock(o); break;
      case 'crystal': drawCrystal(o); break;
      case 'puddle': drawPuddle(o); break;
      case 'enemy': drawEnemy(o.e); break;
      case 'bomb': drawBomb(o.b); break;
      case 'tree': drawTree(o); break;
      case 'rock': drawRock(o); break;
      case 'bush': drawBush(o); break;
      case 'mushroom': drawMushroom(o); break;
      case 'flower': drawFlower(o); break;
      case 'appleTree': drawAppleTree(o); break;
      case 'bananaTree': drawBananaTree(o); break;
      case 'vegetable': drawVegetable(o); break;
      case 'stick': drawStickObj(o); break;
      case 'coalRock': drawCoalRock(o); break;
      case 'matchbox': drawMatchbox(o); break;
      case 'campfire': drawCampfire(o); break;
      case 'bed': drawBed(o); break;
      case 'yagaHouse': drawYagaHouse(o); break;
      case 'carrotPatch': drawCarrotPatch(o); break;
      case 'forestExit': drawForestGate(o); break;
      case 'cat': drawCat(o); break;
      case 'shopCart': drawShopCart(o); break;
      case 'house': drawCityHouse(o); break;
      case 'forge': drawForge(o); break;
      case 'well': drawWell(o); break;
      case 'lantern': drawLantern(o); break;
      case 'bench': drawBench(o); break;
      case 'crate': drawCrate(o); break;
      case 'barrel': drawBarrel(o); break;
      case 'fence': drawFence(o); break;
      case 'cityGate': drawCityGate(o); break;
      case 'sign': drawSignpost(o); break;
      case 'npc': drawNpc(o); break;
      case 'dog': drawDog(o); break;
      case 'bossYaga': drawYaga(o.x, o.y); break;
      case 'bossLeshy': drawLeshy(o.x, o.y); break;
      case 'player': drawPlayer(); break;
    }
  }

  drawSplashes();
  drawPotionsWorld();
  drawArrows();
  drawBossSpeech();
  if (state === 'play') drawPrompt();
  drawFloaters();

  ctx.restore();

  drawNight();
  drawExplosions();
  drawHurtFlash();
  drawPadAim();
  drawHud();
  drawInventory();
  drawCrosshair();
  if (hasTouchControls()) drawTouchControls();
  if (craftOpen) drawCraftPanel();
  if (shopOpen) drawShop();
  if (sleep.active) drawSleepOverlay();
  if (dialog) drawDialog();
}

// Красная вспышка по краям экрана, когда игрока укусили.
function drawHurtFlash() {
  if (player.flash <= 0) return;
  const a = Math.min(0.5, player.flash);
  const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.3, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
  g.addColorStop(0, 'rgba(200, 40, 40, 0)');
  g.addColorStop(1, 'rgba(200, 40, 40, ' + a.toFixed(3) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// Прицел под курсором, когда лук со стрелами наготове.
function drawCrosshair() {
  if (uiMode !== 'keyboard') return; // на телефоне и геймпаде прицел свой
  if (!hasBow() || mouse.x < 0 || slotAt(mouse.x, mouse.y) >= 0) return;
  const ready = invCount('arrow') > 0 && shootTimer <= 0;
  ctx.strokeStyle = ready ? '#f4e9c8' : '#8c6b6b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouse.x - 14, mouse.y);
  ctx.lineTo(mouse.x - 4, mouse.y);
  ctx.moveTo(mouse.x + 4, mouse.y);
  ctx.lineTo(mouse.x + 14, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 14);
  ctx.lineTo(mouse.x, mouse.y - 4);
  ctx.moveTo(mouse.x, mouse.y + 4);
  ctx.lineTo(mouse.x, mouse.y + 14);
  ctx.stroke();
}

// Прицел правого стика геймпада.
function drawPadAim() {
  if (uiMode !== 'gamepad' || !pad.aimActive || state !== 'play' || hasBlockingModal()) return;
  const px = player.x - camera.x;
  const py = player.y - camera.y - 22;
  const x = px + pad.aimX * 92;
  const y = py + pad.aimY * 92;
  ctx.strokeStyle = 'rgba(244, 233, 200, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + pad.aimX * 30, py + pad.aimY * 30);
  ctx.lineTo(x - pad.aimX * 8, y - pad.aimY * 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
}

function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

// Экранные кнопки телефона: джойстик слева, действия справа.
function drawTouchControls() {
  const active = touchJoy.active;

  // Джойстик
  const jx = active ? touchJoy.baseX : TOUCH_JOY.cx;
  const jy = active ? touchJoy.baseY : TOUCH_JOY.cy;
  ctx.save();
  ctx.globalAlpha = active ? 0.95 : 0.62;
  ctx.fillStyle = 'rgba(12, 26, 18, 0.72)';
  ctx.beginPath();
  ctx.arc(jx, jy, TOUCH_JOY.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6f9a78';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(244, 233, 200, 0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(jx - TOUCH_JOY.r + 10, jy);
  ctx.lineTo(jx + TOUCH_JOY.r - 10, jy);
  ctx.moveTo(jx, jy - TOUCH_JOY.r + 10);
  ctx.lineTo(jx, jy + TOUCH_JOY.r - 10);
  ctx.stroke();

  const kx = jx + touchJoy.dx * (TOUCH_JOY.r - TOUCH_JOY.knob / 2);
  const ky = jy + touchJoy.dy * (TOUCH_JOY.r - TOUCH_JOY.knob / 2);
  ctx.fillStyle = active ? 'rgba(123, 189, 99, 0.95)' : 'rgba(70, 105, 80, 0.9)';
  ctx.beginPath();
  ctx.arc(kx, ky, TOUCH_JOY.knob, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#cfe3d2';
  ctx.font = '13px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ХОДЬБА', jx, jy + TOUCH_JOY.r + 18);
  ctx.restore();

  // Кнопки
  for (const b of TOUCH_BUTTONS) {
    let pressed = touchFlash.t > 0 && touchFlash.id === b.id;
    if (!pressed) {
      for (const id of touchHeld.values()) {
        if (id === b.id) {
          pressed = true;
          break;
        }
      }
    }
    ctx.save();
    ctx.globalAlpha = b.id === 'menu' ? 0.82 : 0.9;
    if (b.shape === 'circle') {
      ctx.fillStyle = pressed ? 'rgba(123, 189, 99, 0.92)' : 'rgba(12, 26, 18, 0.78)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = b.id === 'shoot' ? '#ffdf7a' : '#f4e9c8';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = b.id === 'shoot' ? (pressed ? '#12240f' : '#ffdf7a') : '#f4e9c8';
      ctx.font = 'bold ' + b.font + 'px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x, b.y + 7);
    } else {
      roundRectPath(b.x, b.y, b.w, b.h, 14);
      ctx.fillStyle = pressed ? 'rgba(123, 189, 99, 0.92)' : 'rgba(12, 26, 18, 0.78)';
      ctx.fill();
      ctx.strokeStyle = '#f4e9c8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = pressed ? '#12240f' : '#f4e9c8';
      ctx.font = 'bold ' + b.font + 'px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
    }
    ctx.restore();
  }
}

// Короткое сообщение вверху экрана.
function drawToast() {
  if (toast.t <= 0 || !toast.text) return;
  const alpha = Math.min(1, toast.t / 0.5);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.textAlign = 'center';
  const w = Math.min(VIEW_W - 40, ctx.measureText(toast.text).width + 34);
  const x = (VIEW_W - w) / 2;
  ctx.fillStyle = 'rgba(8, 18, 12, 0.92)';
  ctx.fillRect(x, 64, w, 34);
  ctx.strokeStyle = toast.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, 65, w - 2, 32);
  ctx.fillStyle = toast.color;
  ctx.fillText(toast.text, VIEW_W / 2, 86);
  ctx.restore();
}

// Вспышка взрыва рисуется поверх темноты, чтобы её было видно и ночью.
function drawExplosions() {
  for (const b of bombs) {
    if (b.boom <= 0) continue;
    const k = b.boom / 0.4;
    const x = b.x - camera.x;
    const y = b.y - camera.y;
    ctx.globalAlpha = k;
    ctx.fillStyle = '#ffd45c';
    ctx.beginPath();
    ctx.arc(x, y, BOMB_RADIUS * (1.1 - k * 0.35), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e85a1e';
    ctx.beginPath();
    ctx.arc(x, y, BOMB_RADIUS * (0.7 - k * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawArrows() {
  for (const a of arrows) {
    const ang = Math.atan2(a.vy, a.vx);
    ctx.save();
    ctx.translate(a.x, a.y - 22); // летит на высоте груди
    ctx.rotate(ang);
    ctx.fillStyle = '#d8bb85';
    ctx.fillRect(-10, -1, 16, 2);
    ctx.fillStyle = '#b0b6c0';
    ctx.fillRect(6, -2, 5, 4);
    ctx.fillStyle = '#e8e0cf';
    ctx.fillRect(-11, -3, 3, 2);
    ctx.fillRect(-11, 1, 3, 2);
    ctx.restore();
  }
}

// Затемнение экрана ночью (и всегда в пещере) + светлые круги вокруг огня.
function drawNight() {
  const cave = world.kind === 'cave';
  const d = cave ? 0.95 : darkness();
  if (d <= 0.01) return;
  ctx.save();
  ctx.fillStyle = cave
    ? 'rgba(6, 4, 16, ' + (d * 0.8).toFixed(3) + ')'
    : 'rgba(12, 18, 52, ' + (d * 0.72).toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.globalCompositeOperation = 'destination-out';
  const hole = (sx, sy, radius, strength) => {
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    g.addColorStop(0, 'rgba(0,0,0,' + strength + ')');
    g.addColorStop(0.6, 'rgba(0,0,0,' + strength * 0.5 + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  // вокруг самого персонажа видно чуть лучше
  hole(player.x - camera.x, player.y - camera.y - 12, cave ? 160 : 110, cave ? 0.7 : 0.5);
  for (const o of world.objects) {
    const light =
      o.type === 'campfire'
        ? 170
        : o.type === 'crystal' && o.charges > 0
          ? 70
          : o.type === 'caveExit'
            ? 90
            : o.type === 'yagaHouse'
              ? 140
              : o.type === 'lantern'
                ? 100
                : o.type === 'house'
                  ? 120
                  : o.type === 'forge'
                    ? 90
                    : 0;
    if (!light) continue;
    const sx = o.x - camera.x;
    const sy = o.y - camera.y - 6;
    if (sx < -180 || sx > VIEW_W + 180 || sy < -180 || sy > VIEW_H + 180) continue;
    const flicker = o.type === 'campfire' ? 1 + Math.sin(performance.now() / 140 + o.seed * 10) * 0.05 : 1;
    hole(sx, sy, light * flicker, o.type === 'campfire' ? 0.95 : 0.6);
  }
  // взрыв на мгновение освещает всё вокруг
  for (const b of bombs) {
    if (b.boom > 0) hole(b.x - camera.x, b.y - camera.y, BOMB_RADIUS * 2, 1);
  }
  ctx.restore();
}

// Тёмный экран во время сна.
function drawSleepOverlay() {
  const a = sleep.t < 1.2 ? sleep.t / 1.2 : sleep.t > 1.6 ? Math.max(0, 1 - (sleep.t - 1.6) / 1) : 1;
  ctx.fillStyle = 'rgba(4, 8, 18, ' + a.toFixed(3) + ')';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (a > 0.7) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cfe3d2';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText('Ты спишь... Z-z-z', VIEW_W / 2, VIEW_H / 2);
  }
}

// Подсказка над объектом, до которого персонаж дотянулся.
function drawPrompt() {
  if (!nearObj || craftOpen || sleep.active || dialog || shopOpen || menuOpen || helpOpen) return;
  const o = nearObj;
  const info = interactInfo(o);
  if (!info) return;
  const action =
    uiMode === 'touch' ? 'ДЕЙСТВИЕ' : uiMode === 'gamepad' ? 'A' : 'E';
  const text = info.locked ? info.text : action + ' — ' + info.text;
  const top = info.top;
  ctx.font = (IS_TOUCH ? 17 : 15) + 'px "Courier New", monospace';
  const w = ctx.measureText(text).width + 18;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(12, 26, 18, 0.88)';
  ctx.fillRect(o.x - w / 2, top - 22, w, 24);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x - w / 2, top - 22, w, 24);
  ctx.fillStyle = '#f4e9c8';
  ctx.fillText(text, o.x, top - 5);
}

function drawFloaters() {
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Courier New", monospace';
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    ctx.fillStyle = '#1d3222';
    ctx.fillText(f.text, f.x + 1, f.y - f.t * 26 + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - f.t * 26);
  }
  ctx.globalAlpha = 1;
}

function drawGround() {
  if (world.kind === 'cave') {
    drawCaveGround();
    return;
  }
  if (world.kind === 'city') {
    drawCityGround();
    return;
  }
  // травяной фон с пятнами и кустиками
  const x0 = Math.floor(camera.x / 32) * 32;
  const y0 = Math.floor(camera.y / 32) * 32;
  for (let x = x0; x < camera.x + VIEW_W + 32; x += 32) {
    for (let y = y0; y < camera.y + VIEW_H + 32; y += 32) {
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const v = (n % 100) / 100;
      ctx.fillStyle = v < 0.5 ? '#3a6b42' : v < 0.8 ? '#376540' : '#3f7247';
      ctx.fillRect(x, y, 32, 32);
    }
  }

  // озерцо
  const p = world.pond;
  ctx.fillStyle = '#2f5f6e';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d7d8f';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 6, p.rx - 16, p.ry - 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(p.x - 50, p.y - 30, 44, 5);
  ctx.fillRect(p.x + 4, p.y + 12, 30, 4);

  for (const b of world.grass) {
    if (b.x < camera.x - 10 || b.x > camera.x + VIEW_W + 10) continue;
    if (b.y < camera.y - 10 || b.y > camera.y + VIEW_H + 10) continue;
    ctx.fillStyle = b.t < 0.5 ? '#457a4d' : '#315c3a';
    ctx.fillRect(b.x, b.y, 3, 5);
    ctx.fillRect(b.x + 4, b.y + 2, 3, 4);
  }
}

// Каменный пол пещеры и тёмные стены по краям.
function drawCaveGround() {
  const x0 = Math.floor(camera.x / 32) * 32;
  const y0 = Math.floor(camera.y / 32) * 32;
  for (let x = x0; x < camera.x + VIEW_W + 32; x += 32) {
    for (let y = y0; y < camera.y + VIEW_H + 32; y += 32) {
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const v = (n % 100) / 100;
      ctx.fillStyle = v < 0.45 ? '#3d3746' : v < 0.8 ? '#37323f' : '#443d4e';
      ctx.fillRect(x, y, 32, 32);
      if (v > 0.93) {
        ctx.fillStyle = '#2e2936';
        ctx.fillRect(x + 8, y + 10, 14, 6);
      }
    }
  }
  // стены — тёмная кайма по краям пещеры
  ctx.fillStyle = '#1a1622';
  ctx.fillRect(camera.x - 40, -40, VIEW_W + 80, 60);
  ctx.fillRect(camera.x - 40, world.h - 20, VIEW_W + 80, 60);
  ctx.fillRect(-40, camera.y - 40, 60, VIEW_H + 80);
  ctx.fillRect(world.w - 20, camera.y - 40, 60, VIEW_H + 80);
}

function shadow(x, y, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Объект рисуется поверх игрока и закрывает его? Тогда сделаем его полупрозрачным.
function coversPlayer(o, halfW, topY) {
  if (o.y <= player.y) return false;
  if (Math.abs(o.x - player.x) > halfW + 8) return false;
  return topY < player.y && o.y > player.y - 34;
}

function drawTree(o) {
  const fade = coversPlayer(o, o.crown, o.y - o.h - 6 - o.crown);
  if (fade) ctx.globalAlpha = 0.45;
  shadow(o.x, o.y + 2, o.crown * 0.55, 8);
  ctx.fillStyle = '#5b3a22';
  ctx.fillRect(o.x - 6, o.y - o.h, 12, o.h);
  ctx.fillStyle = '#472c19';
  ctx.fillRect(o.x + 2, o.y - o.h, 4, o.h);

  const light = o.tint < 0.5 ? '#4f9a52' : '#3f8a4a';
  const dark = o.tint < 0.5 ? '#357a3d' : '#2c6b39';
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(o.x, o.y - o.h - 6, o.crown, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(o.x - o.crown * 0.3, o.y - o.h - o.crown * 0.45, o.crown * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(o.x + o.crown * 0.45, o.y - o.h - 2, o.crown * 0.45, 0, Math.PI * 2);
  ctx.fill();
  if (fade) ctx.globalAlpha = 1;
}

// Яблоня: крона посветлее обычного дерева, на ней висят яблоки.
function drawAppleTree(o) {
  const cy = o.y - o.h - 6;
  const fade = coversPlayer(o, o.crown, cy - o.crown);
  if (fade) ctx.globalAlpha = 0.45;
  shadow(o.x, o.y + 2, o.crown * 0.55, 8);
  ctx.fillStyle = '#6b4426';
  ctx.fillRect(o.x - 6, o.y - o.h, 12, o.h);
  ctx.fillStyle = '#553219';
  ctx.fillRect(o.x + 2, o.y - o.h, 4, o.h);

  ctx.fillStyle = '#3f8f45';
  ctx.beginPath();
  ctx.arc(o.x, cy, o.crown, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5cb057';
  ctx.beginPath();
  ctx.arc(o.x - o.crown * 0.35, cy - o.crown * 0.4, o.crown * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(o.x + o.crown * 0.45, cy + o.crown * 0.1, o.crown * 0.45, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < o.fruits; i++) {
    const s = o.spots[i];
    const fx = Math.round(o.x + s.dx);
    const fy = Math.round(cy + s.dy);
    ctx.fillStyle = '#3f7a35';
    ctx.fillRect(fx, fy - 6, 2, 3);
    ctx.fillStyle = '#cc2f2a';
    ctx.fillRect(fx - 4, fy - 4, 8, 8);
    ctx.fillStyle = '#ee6a5c';
    ctx.fillRect(fx - 3, fy - 3, 3, 3);
  }
  if (fade) ctx.globalAlpha = 1;
}

// Банановая пальма: тонкий ствол, широкие листья и связки бананов.
function drawBananaTree(o) {
  const cy = o.y - o.h;
  const fade = coversPlayer(o, o.crown + 10, cy - 24);
  if (fade) ctx.globalAlpha = 0.45;
  shadow(o.x, o.y + 2, 16, 6);
  ctx.fillStyle = '#8a6a3c';
  ctx.fillRect(o.x - 5, o.y - o.h, 10, o.h);
  ctx.fillStyle = '#6d5230';
  for (let y = o.y - o.h + 6; y < o.y; y += 10) ctx.fillRect(o.x - 5, y, 10, 3);

  // листья-«вееры» расходятся от верхушки ствола
  const tilts = [-1.45, -0.85, -0.3, 0.3, 0.85, 1.45];
  tilts.forEach((t, i) => {
    ctx.save();
    ctx.translate(o.x, cy + 2);
    ctx.rotate(t);
    ctx.fillStyle = i % 2 ? '#4fa054' : '#3a8a45';
    ctx.beginPath();
    ctx.ellipse(0, -20, 8, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(18, 48, 24, 0.4)';
    ctx.fillRect(-1, -40, 2, 40);
    ctx.restore();
  });

  // связки бананов висят под листьями
  for (let i = 0; i < o.fruits; i++) {
    const fx = Math.round(o.x + (i - (o.fruits - 1) / 2) * 13);
    const fy = Math.round(cy + 8);
    ctx.fillStyle = '#6d5230';
    ctx.fillRect(fx - 1, fy - 4, 2, 4);
    ctx.fillStyle = '#f0cd33';
    ctx.fillRect(fx - 6, fy, 12, 4);
    ctx.fillRect(fx - 5, fy + 4, 10, 4);
    ctx.fillStyle = '#d0a41c';
    ctx.fillRect(fx - 4, fy + 8, 8, 3);
    ctx.fillStyle = '#fbe98a';
    ctx.fillRect(fx - 5, fy + 1, 4, 2);
  }
  if (fade) ctx.globalAlpha = 1;
}

// Грядка с овощами — сквозь неё можно проходить.
function drawVegetable(o) {
  ctx.fillStyle = '#5b4530';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, 20, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a3726';
  ctx.fillRect(o.x - 16, o.y - 2, 32, 2);

  for (let i = 0; i < o.fruits; i++) {
    const s = o.spots[i];
    const fx = Math.round(o.x + s.dx);
    const fy = Math.round(o.y + s.dy * 0.5);
    ctx.fillStyle = '#3f8f45';
    ctx.fillRect(fx - 5, fy - 12, 4, 6);
    ctx.fillRect(fx + 1, fy - 13, 4, 7);
    ctx.fillStyle = o.veg.body;
    ctx.fillRect(fx - 5, fy - 7, 10, 7);
    ctx.fillStyle = o.veg.dark;
    ctx.fillRect(fx - 5, fy - 2, 10, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(fx - 3, fy - 6, 2, 2);
  }
}

// Сухая палка на земле.
function drawStickObj(o) {
  if (o.taken) return;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(o.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(-11, 3, 22, 3);
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(-11, -2, 22, 4);
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(-11, 1, 22, 1);
  ctx.fillRect(4, -5, 5, 3);
  ctx.restore();
}

// Камень с углём: чёрные блестящие кусочки в серой породе.
function drawCoalRock(o) {
  const h = o.w * 0.7;
  shadow(o.x, o.y + 2, o.w * 0.6, 6);
  ctx.fillStyle = '#7d818a';
  ctx.fillRect(o.x - o.w / 2, o.y - h, o.w, h);
  ctx.fillStyle = '#969ba3';
  ctx.fillRect(o.x - o.w / 2 + 3, o.y - h + 3, o.w * 0.4, o.w * 0.25);
  ctx.fillStyle = '#5f636a';
  ctx.fillRect(o.x - o.w / 2, o.y - 5, o.w, 5);
  for (let i = 0; i < o.charges; i++) {
    const cx = o.x - o.w / 4 + i * 7;
    const cy = o.y - h + 6 + (i % 2) * 7;
    ctx.fillStyle = '#26262c';
    ctx.fillRect(cx, cy, 6, 5);
    ctx.fillStyle = '#4e4e58';
    ctx.fillRect(cx + 1, cy + 1, 2, 2);
  }
}

// Коробок спичек — маленький, но заметный.
function drawMatchbox(o) {
  if (o.taken) return;
  shadow(o.x, o.y + 1, 9, 4);
  ctx.fillStyle = '#c9903f';
  ctx.fillRect(o.x - 8, o.y - 9, 16, 9);
  ctx.fillStyle = '#e0aa5c';
  ctx.fillRect(o.x - 8, o.y - 9, 16, 3);
  ctx.fillStyle = '#7d4a2a';
  ctx.fillRect(o.x - 6, o.y - 6, 12, 3);
  ctx.fillStyle = '#cc2f2a';
  ctx.fillRect(o.x - 3, o.y - 13, 3, 4);
  ctx.fillStyle = '#d8bb85';
  ctx.fillRect(o.x - 2, o.y - 10, 1, 2);
}

// Костёр: поленья и пляшущее пламя.
function drawCampfire(o) {
  shadow(o.x, o.y + 2, 16, 6);
  ctx.fillStyle = '#4a3726';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // камешки вокруг кострища
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.fillStyle = '#8b8f96';
    ctx.fillRect(o.x + Math.cos(a) * 16 - 3, o.y + Math.sin(a) * 8 - 2, 6, 4);
  }
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(o.x - 12, o.y - 5, 24, 4);
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(o.x - 9, o.y - 9, 18, 4);

  const t = performance.now() / 120 + o.seed * 10;
  const f = 1 + Math.sin(t) * 0.14;
  ctx.fillStyle = '#e85a1e';
  ctx.beginPath();
  ctx.moveTo(o.x - 9, o.y - 8);
  ctx.quadraticCurveTo(o.x - 3, o.y - 22 * f, o.x, o.y - 30 * f);
  ctx.quadraticCurveTo(o.x + 3, o.y - 22 * f, o.x + 9, o.y - 8);
  ctx.fill();
  ctx.fillStyle = '#f0a02a';
  ctx.beginPath();
  ctx.moveTo(o.x - 5, o.y - 8);
  ctx.quadraticCurveTo(o.x - 1, o.y - 16 * f, o.x + 1, o.y - 21 * f);
  ctx.quadraticCurveTo(o.x + 3, o.y - 14 * f, o.x + 5, o.y - 8);
  ctx.fill();
  ctx.fillStyle = '#ffe07a';
  ctx.fillRect(o.x - 2, o.y - 13 * f, 4, 6);
  // искорки
  for (let i = 0; i < 3; i++) {
    const s = ((performance.now() / 700 + i * 0.33 + o.seed) % 1);
    ctx.globalAlpha = 1 - s;
    ctx.fillStyle = '#ffd45c';
    ctx.fillRect(o.x + Math.sin(t + i * 2) * 7, o.y - 24 - s * 22, 2, 2);
    ctx.globalAlpha = 1;
  }
}

// Кровать из палок и листьев.
function drawBed(o) {
  shadow(o.x, o.y + 2, 20, 7);
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(o.x - 20, o.y - 16, 40, 16);
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(o.x - 20, o.y - 18, 40, 4);
  ctx.fillStyle = '#f2ead6';
  ctx.fillRect(o.x - 17, o.y - 14, 12, 11); // подушка
  ctx.fillStyle = '#3f8f45';
  ctx.fillRect(o.x - 4, o.y - 14, 21, 11); // одеяло из листьев
  ctx.fillStyle = '#4fa054';
  ctx.fillRect(o.x - 4, o.y - 14, 21, 4);
  ctx.fillStyle = '#357a3d';
  ctx.fillRect(o.x - 4, o.y - 6, 21, 3);
  ctx.fillStyle = '#5b3a22';
  ctx.fillRect(o.x - 20, o.y - 3, 4, 5);
  ctx.fillRect(o.x + 16, o.y - 3, 4, 5);
}

/* ------------------------ Пещеры: объекты и враги ------------------------- */

// Вход в пещеру: скала с чёрным зевом и табличкой с номером.
function drawCaveEntry(o) {
  shadow(o.x, o.y + 4, 44, 12);
  ctx.fillStyle = '#6c7077';
  ctx.beginPath();
  ctx.moveTo(o.x - 46, o.y + 6);
  ctx.lineTo(o.x - 30, o.y - 52);
  ctx.lineTo(o.x + 30, o.y - 52);
  ctx.lineTo(o.x + 46, o.y + 6);
  ctx.fill();
  ctx.fillStyle = '#8b8f96';
  ctx.beginPath();
  ctx.moveTo(o.x - 40, o.y + 6);
  ctx.lineTo(o.x - 26, o.y - 46);
  ctx.lineTo(o.x - 2, o.y - 46);
  ctx.lineTo(o.x - 6, o.y + 6);
  ctx.fill();
  // тёмный вход
  ctx.fillStyle = '#120f1a';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y - 2, 20, 26, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(o.x - 20, o.y - 2, 40, 8);
  ctx.fillStyle = '#2a2434';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y + 2, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText('ПЕЩЕРА ' + o.level, o.x, o.y - 58);
}

// Выход из пещеры — светлый проём наружу.
function drawCaveExit(o) {
  ctx.fillStyle = '#1a1622';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, 30, 34, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#6d7fa0';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y - 2, 22, 26, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(o.x - 22, o.y - 2, 44, 6);
  ctx.fillStyle = '#a9bcd8';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y - 2, 14, 17, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(o.x - 14, o.y - 2, 28, 5);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillText('ВЫХОД', o.x, o.y - 42);
}

function drawCaveRock(o) {
  const h = o.w * 0.8;
  shadow(o.x, o.y + 2, o.w * 0.6, 7);
  ctx.fillStyle = '#4a4456';
  ctx.beginPath();
  ctx.moveTo(o.x - o.w / 2, o.y);
  ctx.lineTo(o.x - o.w / 3, o.y - h);
  ctx.lineTo(o.x + o.w / 3, o.y - h * 0.9);
  ctx.lineTo(o.x + o.w / 2, o.y);
  ctx.fill();
  ctx.fillStyle = '#5b5468';
  ctx.beginPath();
  ctx.moveTo(o.x - o.w / 2 + 4, o.y);
  ctx.lineTo(o.x - o.w / 3 + 3, o.y - h + 4);
  ctx.lineTo(o.x - 2, o.y - h * 0.7);
  ctx.lineTo(o.x - 4, o.y);
  ctx.fill();
  ctx.fillStyle = '#332e3d';
  ctx.fillRect(o.x - o.w / 2, o.y - 5, o.w, 5);
}

function drawStalagmite(o) {
  shadow(o.x, o.y + 1, 9, 4);
  ctx.fillStyle = '#544d61';
  ctx.beginPath();
  ctx.moveTo(o.x - 7, o.y);
  ctx.lineTo(o.x, o.y - o.h);
  ctx.lineTo(o.x + 7, o.y);
  ctx.fill();
  ctx.fillStyle = '#6a6279';
  ctx.beginPath();
  ctx.moveTo(o.x - 3, o.y);
  ctx.lineTo(o.x - 1, o.y - o.h * 0.85);
  ctx.lineTo(o.x + 1, o.y);
  ctx.fill();
}

// Друза кристаллов — светится в темноте.
function drawCrystal(o) {
  shadow(o.x, o.y + 1, 12, 5);
  const glow = 0.5 + Math.sin(performance.now() / 400 + o.seed * 8) * 0.2;
  ctx.globalAlpha = glow * 0.5;
  ctx.fillStyle = '#a45de0';
  ctx.beginPath();
  ctx.arc(o.x, o.y - 10, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#463b57';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < o.charges; i++) {
    const dx = (i - (o.charges - 1) / 2) * 11;
    const h = 18 + (i % 2) * 7;
    ctx.fillStyle = o.tint < 0.5 ? '#a45de0' : '#6f7ce8';
    ctx.beginPath();
    ctx.moveTo(o.x + dx - 6, o.y);
    ctx.lineTo(o.x + dx, o.y - h);
    ctx.lineTo(o.x + dx + 6, o.y);
    ctx.fill();
    ctx.fillStyle = '#e0bcff';
    ctx.beginPath();
    ctx.moveTo(o.x + dx - 2, o.y - 2);
    ctx.lineTo(o.x + dx, o.y - h + 2);
    ctx.lineTo(o.x + dx + 1, o.y - 2);
    ctx.fill();
  }
}

function drawPuddle(o) {
  ctx.fillStyle = '#2f4a5e';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y, o.w, o.w * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f6076';
  ctx.beginPath();
  ctx.ellipse(o.x - 2, o.y - 2, o.w * 0.6, o.w * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Волк или летучая мышь.
function drawEnemy(e) {
  if (e.hurt > 0) ctx.globalAlpha = 0.65;
  if (e.kind === 'wolf') drawWolf(e);
  else drawBat(e);
  ctx.globalAlpha = 1;
  drawEnemyBar(e);
}

function drawEnemyBar(e) {
  if (e.hp >= e.maxHp) return;
  const w = 30;
  const top = e.y - (e.kind === 'wolf' ? 30 : 26);
  ctx.fillStyle = 'rgba(12, 10, 16, 0.8)';
  ctx.fillRect(e.x - w / 2, top, w, 5);
  ctx.fillStyle = '#d24a44';
  ctx.fillRect(e.x - w / 2 + 1, top + 1, (w - 2) * Math.max(0, e.hp / e.maxHp), 3);
}

function drawWolf(e) {
  const flip = e.dir === 'left' ? -1 : 1;
  const step = Math.sin(performance.now() / 90 + e.phase) * 2;
  shadow(e.x, e.y + 2, 16, 5);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(flip, 1);

  ctx.fillStyle = '#5a5f68'; // лапы
  ctx.fillRect(-11, -8 + step * 0.3, 4, 8);
  ctx.fillRect(6, -8 - step * 0.3, 4, 8);
  ctx.fillRect(-5, -8 - step * 0.3, 4, 8);
  ctx.fillRect(1, -8 + step * 0.3, 4, 8);

  ctx.fillStyle = '#71767f'; // туловище
  ctx.fillRect(-13, -20, 24, 13);
  ctx.fillStyle = '#5a5f68';
  ctx.fillRect(-13, -11, 24, 4);
  ctx.fillStyle = '#8b909a'; // грудь
  ctx.fillRect(4, -18, 8, 8);

  ctx.fillStyle = '#71767f'; // хвост
  ctx.fillRect(-19, -22 + step * 0.5, 8, 5);

  ctx.fillStyle = '#8b909a'; // голова
  ctx.fillRect(8, -27, 12, 11);
  ctx.fillStyle = '#71767f';
  ctx.fillRect(17, -22, 6, 5); // морда
  ctx.fillStyle = '#2b2b32';
  ctx.fillRect(21, -21, 3, 3); // нос
  ctx.fillStyle = '#5a5f68'; // уши
  ctx.fillRect(9, -32, 4, 6);
  ctx.fillRect(15, -32, 4, 6);
  ctx.fillStyle = '#ffe14d'; // светящиеся глаза
  ctx.fillRect(14, -25, 3, 3);
  ctx.fillStyle = '#e8e0cf'; // клыки
  ctx.fillRect(20, -18, 2, 3);
  ctx.restore();
}

function drawBat(e) {
  const flap = Math.sin(performance.now() / 70 + e.phase) * 7;
  const lvl = world.level || 1;
  const body = lvl >= 3 ? '#5b2b52' : lvl === 2 ? '#43304f' : '#3a3040';
  const wing = lvl >= 3 ? '#8a3a6a' : lvl === 2 ? '#5c4370' : '#4b4055';
  ctx.save();
  ctx.translate(e.x, e.y - 14);

  ctx.fillStyle = wing; // крылья
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-20, -6 + flap);
  ctx.lineTo(-22, 4 + flap);
  ctx.lineTo(-4, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(20, -6 - flap);
  ctx.lineTo(22, 4 - flap);
  ctx.lineTo(4, 5);
  ctx.fill();

  ctx.fillStyle = body; // тельце
  ctx.fillRect(-5, -6, 10, 12);
  ctx.fillRect(-6, -10, 4, 5); // ушки
  ctx.fillRect(2, -10, 4, 5);
  ctx.fillStyle = '#ff6b6b'; // глазки
  ctx.fillRect(-3, -4, 2, 2);
  ctx.fillRect(1, -4, 2, 2);
  ctx.fillStyle = '#e8e0cf';
  ctx.fillRect(-2, 1, 4, 2);
  ctx.restore();

  // тень на полу, чтобы было понятно, где мышь летит
  ctx.globalAlpha = 0.3;
  shadow(e.x, e.y + 2, 9, 3);
  ctx.globalAlpha = 1;
}

// Брошенная бомба с горящим фитилём.
function drawBomb(b) {
  if (b.boom > 0) return; // взрыв рисуется отдельно, поверх темноты
  shadow(b.x, b.y + 2, 9, 4);
  ctx.fillStyle = '#22222a';
  ctx.beginPath();
  ctx.arc(b.x, b.y - 6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5c5c68';
  ctx.fillRect(b.x - 5, b.y - 10, 3, 3);
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(b.x + 1, b.y - 18, 2, 5);
  // фитиль мигает всё быстрее
  if (Math.sin(performance.now() / (40 + b.fuse * 60)) > 0) {
    ctx.fillStyle = '#ffd45c';
    ctx.fillRect(b.x + 2, b.y - 21, 3, 3);
  }
}

function drawRock(o) {
  shadow(o.x, o.y + 2, o.w * 0.6, 6);
  ctx.fillStyle = '#8b8f96';
  ctx.fillRect(o.x - o.w / 2, o.y - o.w * 0.7, o.w, o.w * 0.7);
  ctx.fillStyle = '#a8adb5';
  ctx.fillRect(o.x - o.w / 2 + 3, o.y - o.w * 0.7 + 3, o.w * 0.45, o.w * 0.3);
  ctx.fillStyle = '#6c7077';
  ctx.fillRect(o.x - o.w / 2, o.y - 5, o.w, 5);
}

function drawBush(o) {
  const fade = coversPlayer(o, 14, o.y - 24);
  if (fade) ctx.globalAlpha = 0.5;
  shadow(o.x, o.y + 1, 14, 5);
  ctx.fillStyle = '#2f6b3a';
  ctx.beginPath();
  ctx.arc(o.x, o.y - 10, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3d8548';
  ctx.beginPath();
  ctx.arc(o.x - 5, o.y - 14, 8, 0, Math.PI * 2);
  ctx.fill();
  if (fade) ctx.globalAlpha = 1;
}

function drawMushroom(o) {
  ctx.fillStyle = '#e8e0cf';
  ctx.fillRect(o.x - 2, o.y - 7, 4, 7);
  ctx.fillStyle = '#c8452f';
  ctx.fillRect(o.x - 6, o.y - 12, 12, 5);
  ctx.fillStyle = '#f2e9dc';
  ctx.fillRect(o.x - 3, o.y - 11, 3, 3);
}

function drawFlower(o) {
  ctx.fillStyle = '#3d7d46';
  ctx.fillRect(o.x - 1, o.y - 7, 2, 7);
  ctx.fillStyle = o.color;
  ctx.fillRect(o.x - 3, o.y - 11, 6, 4);
}

/* ------------------ Избушка, огород, ворота и боссы ----------------------- */

// Облачко с репликой над головой.
function speechBubble(x, y, text, maxW) {
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'center';
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
  const h = lines.length * 15 + 12;
  const bx = Math.round(x - w / 2);
  const by = Math.round(y - h);
  ctx.fillStyle = 'rgba(12, 26, 18, 0.92)';
  ctx.fillRect(bx, by, w, h);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 1, by + 1, w - 2, h - 2);
  // хвостик облачка
  ctx.beginPath();
  ctx.moveTo(x - 6, by + h);
  ctx.lineTo(x + 6, by + h);
  ctx.lineTo(x, by + h + 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4e9c8';
  lines.forEach((l, i) => ctx.fillText(l, x, by + 18 + i * 15));
  ctx.textAlign = 'left';
}

// Избушка Бабы-яги на курьих ножках: сруб, окно со светом, дверь и труба.
function drawYagaHouse(o) {
  const U = 3;
  const left = o.x - 20 * U;
  const top = o.y - 44 * U;
  const px = (ix, iy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(left + ix * U), Math.round(top + iy * U), w * U, h * U);
  };
  shadow(o.x, o.y + 2, 56, 10);

  // куриные ноги
  px(8, 36, 3, 7, '#d8a03c');
  px(29, 36, 3, 7, '#d8a03c');
  px(6, 42, 6, 1, '#d8a03c');
  px(28, 42, 6, 1, '#d8a03c');
  px(5, 43, 7, 1, '#b8822c');
  px(28, 43, 7, 1, '#b8822c');

  // сруб из брёвен
  px(5, 16, 30, 21, '#6b4a2a');
  for (let i = 0; i < 7; i++) px(5, 17 + i * 3, 30, 1, '#553a20');
  px(5, 16, 1, 21, '#4a3019');
  px(34, 16, 1, 21, '#4a3019');
  px(6, 36, 28, 1, '#3f2714');

  // крыша: ступенчатый «терем»
  for (let i = 0; i < 7; i++) {
    px(6 + i, 15 - i, 28 - i * 2, 1, i % 2 ? '#4a2f1c' : '#5a3a22');
  }
  px(12, 7, 16, 2, '#3f2714');
  px(20, 4, 1, 4, '#6b4a2a'); // флюгер-палка

  // труба и дым
  px(26, 2, 4, 7, '#5a4a3a');
  px(26, 2, 4, 2, '#4a3c2e');
  const smoke = performance.now() / 900;
  for (let i = 0; i < 3; i++) {
    const k = (smoke + i * 0.33) % 1;
    ctx.globalAlpha = 0.38 * (1 - k);
    ctx.fillStyle = '#cfd8e0';
    ctx.beginPath();
    ctx.arc(left + 28 * U, top + 2 * U - k * 28, 4 + k * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // тёплый свет из окна
  const gx = left + 13.5 * U;
  const gy = top + 25.5 * U;
  const glow = ctx.createRadialGradient(gx, gy, 4, gx, gy, 52);
  glow.addColorStop(0, 'rgba(245, 217, 138, 0.32)');
  glow.addColorStop(1, 'rgba(245, 217, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(gx - 52, gy - 52, 104, 104);

  // окно с наличниками
  px(10, 21, 8, 8, '#3f2714');
  px(11, 22, 6, 6, '#f5d98a');
  px(13, 22, 1, 6, '#4a2f18');
  px(11, 24, 6, 1, '#4a2f18');
  px(12, 23, 1, 1, '#fff2c0');

  // дверь и крыльцо
  px(22, 25, 8, 12, '#3f2714');
  px(23, 26, 7, 11, '#6b4a2a');
  px(25, 26, 1, 11, '#553a20');
  px(27, 31, 1, 1, '#e8c85a');
  px(21, 36, 10, 1, '#4a3019');

  // мох на брёвнах
  px(7, 32, 5, 1, '#4f7a34');
  px(31, 27, 3, 1, '#4f7a34');
}

// Грядка с морковью. Пока Баба-яга жива, на ней табличка «ЗАКРЫТО».
function drawCarrotPatch(o) {
  const locked = !yagaDefeated;

  // заборчик позади грядки
  for (let i = 0; i < 5; i++) {
    const fx = o.x - 46 + i * 23;
    ctx.fillStyle = '#8a6234';
    ctx.fillRect(fx, o.y - 40, 4, 24);
    ctx.fillStyle = '#b08a4a';
    ctx.fillRect(fx, o.y - 40, 4, 2);
  }
  ctx.fillStyle = '#7a5530';
  ctx.fillRect(o.x - 48, o.y - 32, 96, 3);

  // сама грядка
  ctx.fillStyle = '#4a3320';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y + 4, 40, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2718';
  ctx.beginPath();
  ctx.ellipse(o.x, o.y + 4, 33, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#553d26';
  ctx.fillRect(o.x - 30, o.y - 2, 60, 2);
  ctx.fillRect(o.x - 26, o.y + 6, 52, 2);

  const spots = o.spots || [];
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const cx = o.x + s.dx;
    const cy = o.y + s.dy * 0.5 + 2;
    const ripe = i < o.fruits && !locked;
    // ботва
    ctx.fillStyle = ripe ? '#4fa054' : '#5a6a3a';
    ctx.fillRect(cx - 5, cy - 16, 2, 9);
    ctx.fillRect(cx - 1, cy - 19, 2, 12);
    ctx.fillRect(cx + 3, cy - 15, 2, 8);
    if (ripe) {
      ctx.fillStyle = '#e8822a';
      ctx.fillRect(cx - 4, cy - 6, 8, 6);
      ctx.fillStyle = '#d06818';
      ctx.fillRect(cx - 2, cy, 4, 4);
      ctx.fillStyle = '#ffb060';
      ctx.fillRect(cx - 3, cy - 5, 2, 3);
    } else if (locked) {
      ctx.fillStyle = '#3a2718';
      ctx.fillRect(cx - 5, cy - 5, 10, 5);
    }
  }

  if (locked) {
    ctx.fillStyle = '#8a6234';
    ctx.fillRect(o.x - 2, o.y - 52, 3, 20);
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(o.x - 26, o.y - 64, 52, 15);
    ctx.fillStyle = '#3f2714';
    ctx.fillRect(o.x - 26, o.y - 64, 52, 2);
    ctx.fillStyle = '#3f2714';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ЗАКРЫТО', o.x, o.y - 53);
    ctx.textAlign = 'left';
  }
}

// Ворота — выход из леса. Открываются только после победы над Лешим.
function drawForestGate(o) {
  const open = leshyDefeated;
  const x = o.x;
  const y = o.y;
  shadow(x, y + 2, 74, 12);

  // каменная стена по бокам ворот — видно, что выхода нет
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const wx = x + dir * (76 + i * 26);
      ctx.fillStyle = i % 2 ? '#6b6b73' : '#7a7a84';
      ctx.fillRect(wx - 13, y - 44 + (i % 2) * 5, 26, 26);
      ctx.fillStyle = '#5a5a62';
      ctx.fillRect(wx - 13, y - 21 + (i % 2) * 5, 26, 5);
    }
  }

  // тропинка к воротам
  ctx.fillStyle = '#b9a887';
  ctx.fillRect(x - 42, y - 4, 84, 6);
  ctx.fillStyle = '#a08e6d';
  ctx.fillRect(x - 34, y + 2, 68, 4);

  // столбы
  for (const sx of [-70, 58]) {
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(x + sx, y - 110, 14, 110);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x + sx, y - 110, 5, 110);
    ctx.fillStyle = '#3f2714';
    ctx.fillRect(x + sx, y - 115, 14, 6);
  }
  // перекладина
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(x - 74, y - 124, 148, 12);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 74, y - 124, 148, 3);

  if (!open) {
    // запертые створки
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(x - 56, y - 110, 112, 110);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#5a3f22' : '#553a20';
      ctx.fillRect(x - 56 + i * 19, y - 110, 3, 110);
    }
    ctx.fillStyle = '#3f2714';
    ctx.fillRect(x - 2, y - 110, 5, 110);
    // замок
    ctx.fillStyle = '#c8c8d0';
    ctx.fillRect(x - 7, y - 62, 14, 12);
    ctx.fillStyle = '#8a8a95';
    ctx.fillRect(x - 5, y - 70, 10, 8);
    ctx.fillStyle = '#6b6b73';
    ctx.fillRect(x - 2, y - 58, 4, 5);
  } else {
    // открытый проход с тёплым светом и тропинкой
    const g = ctx.createLinearGradient(x, y - 110, x, y + 4);
    g.addColorStop(0, 'rgba(255, 240, 190, 0.55)');
    g.addColorStop(1, 'rgba(255, 240, 190, 0.06)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 56, y - 110, 112, 114);
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(x - 56, y - 2, 112, 4);
  }

  // вывеска
  ctx.fillStyle = '#c9b48a';
  ctx.fillRect(x - 34, y - 104, 68, 18);
  ctx.fillStyle = '#3f2714';
  ctx.fillRect(x - 34, y - 104, 68, 2);
  ctx.fillStyle = '#3f2714';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(open ? 'ОТКРЫТО' : 'ВЫХОД', x, y - 90);
  ctx.textAlign = 'left';
}

// Чёрная кошка Бабы-яги.
// Лавка одежды: телега с полосатым навесом и торговец за прилавком.
function drawShopCart(o) {
  const x = o.x;
  const y = o.y;
  shadow(x, y + 2, 54, 10);

  // торговец за прилавком
  ctx.fillStyle = '#4a3f6b';
  ctx.fillRect(x + 2, y - 92, 24, 40);
  ctx.fillStyle = '#f0c39a';
  ctx.fillRect(x + 7, y - 108, 14, 16);
  ctx.fillStyle = '#3a2f52';
  ctx.fillRect(x + 2, y - 116, 24, 10);
  ctx.fillRect(x, y - 112, 6, 22);
  ctx.fillRect(x + 22, y - 112, 6, 22);
  ctx.fillStyle = '#2b2b33';
  ctx.fillRect(x + 10, y - 100, 2, 2);
  ctx.fillRect(x + 16, y - 100, 2, 2);
  ctx.fillStyle = '#c94a4a';
  ctx.fillRect(x + 11, y - 96, 6, 1);

  // колёса
  for (const wx of [x - 28, x + 26]) {
    ctx.fillStyle = '#4a3520';
    ctx.beginPath();
    ctx.arc(wx, y - 13, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2a';
    ctx.beginPath();
    ctx.arc(wx, y - 13, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3f2714';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(wx + Math.cos(a) * 9, y - 13 + Math.sin(a) * 9);
      ctx.lineTo(wx - Math.cos(a) * 9, y - 13 - Math.sin(a) * 9);
      ctx.stroke();
    }
  }

  // корпус телеги
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(x - 40, y - 52, 80, 38);
  ctx.fillStyle = '#6b4a26';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 40, y - 48 + i * 9, 80, 3);
  ctx.fillStyle = '#a5822c';
  ctx.fillRect(x - 42, y - 58, 84, 6);

  // товар на прилавке
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(x - 33, y - 66, 14, 5);
  ctx.fillRect(x - 35, y - 61, 18, 2);
  ctx.fillStyle = '#3f7fd0';
  ctx.fillRect(x - 9, y - 64, 16, 4);
  ctx.fillStyle = '#e8c85a';
  ctx.fillRect(x + 18, y - 67, 12, 4);
  ctx.fillRect(x + 14, y - 63, 20, 2);

  // столбы и полосатый навес
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(x - 40, y - 118, 4, 62);
  ctx.fillRect(x + 36, y - 118, 4, 62);
  const stripes = ['#c0392b', '#f2e9dc', '#c0392b', '#f2e9dc', '#c0392b', '#f2e9dc'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = stripes[i];
    ctx.fillRect(x - 42 + i * 14, y - 138, 14, 20);
    ctx.beginPath();
    ctx.arc(x - 35 + i * 14, y - 118, 7, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#3f2714';
  ctx.fillRect(x - 44, y - 140, 88, 3);

  // вывеска на навесе
  ctx.fillStyle = '#c9b48a';
  ctx.fillRect(x - 30, y - 134, 60, 14);
  ctx.fillStyle = '#3f2714';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ОДЕЖДА', x, y - 123);
  ctx.textAlign = 'left';
}

/* ---------------------------- Рисуем город ------------------------------- */

// Каменная мостовая, дорога через площадь и дорожка к воротам.
function drawCityGround() {
  const x0 = Math.floor(camera.x / 32) * 32;
  const y0 = Math.floor(camera.y / 32) * 32;
  for (let x = x0; x < camera.x + VIEW_W + 32; x += 32) {
    for (let y = y0; y < camera.y + VIEW_H + 32; y += 32) {
      const n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const v = (n % 100) / 100;
      ctx.fillStyle = v < 0.5 ? '#7a7a72' : v < 0.8 ? '#73736b' : '#82827a';
      ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = '#6a6a62';
      ctx.fillRect(x, y, 32, 2);
      ctx.fillRect(x, y, 2, 32);
      if (v > 0.82) {
        ctx.fillStyle = '#8a8a82';
        ctx.fillRect(x + 6, y + 8, 10, 7);
      }
    }
  }

  // дорога с запада на восток
  ctx.fillStyle = '#b9a887';
  ctx.fillRect(0, 380, world.w, 140);
  ctx.fillStyle = '#c2b294';
  ctx.fillRect(0, 388, world.w, 124);
  for (let x = Math.floor(camera.x / 62) * 62; x < camera.x + VIEW_W + 62; x += 62) {
    ctx.fillStyle = 'rgba(120, 104, 78, 0.28)';
    ctx.fillRect(x, 388, 2, 124);
  }
  ctx.fillStyle = 'rgba(120, 104, 78, 0.28)';
  ctx.fillRect(0, 448, world.w, 2);

  // дорожка от площади к воротам
  ctx.fillStyle = '#b9a887';
  ctx.fillRect(640, 520, 120, 380);
  ctx.fillStyle = '#c2b294';
  ctx.fillRect(646, 520, 108, 380);
  ctx.fillStyle = 'rgba(120, 104, 78, 0.25)';
  for (let y = 520; y < 900; y += 54) ctx.fillRect(646, y, 108, 2);
}

// Обычный городской дом с вывеской.
function drawCityHouse(o) {
  const w = o.w;
  const h = o.h;
  const x = o.x;
  const y = o.y;
  const left = x - w / 2;
  const top = y - h;
  shadow(x, y + 2, w * 0.52, 9);

  ctx.fillStyle = o.wall;
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(left, top, w, 5);
  ctx.fillRect(left, top, 5, h);
  ctx.fillRect(left + w - 5, top, 5, h);
  ctx.fillRect(left, y - 5, w, 5);
  ctx.fillRect(left, top + h * 0.5, w, 5);

  // крыша
  ctx.fillStyle = o.roof;
  ctx.beginPath();
  ctx.moveTo(left - 12, top + 2);
  ctx.lineTo(x, top - 44);
  ctx.lineTo(left + w + 12, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.moveTo(left - 12, top + 2);
  ctx.lineTo(x, top - 44);
  ctx.lineTo(x, top + 2);
  ctx.closePath();
  ctx.fill();

  // окна со светом
  const wy = top + h * 0.56;
  for (const wx of [left + 16, left + w - 42]) {
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(wx, wy, 26, 24);
    ctx.fillStyle = '#f5d98a';
    ctx.fillRect(wx + 3, wy + 3, 20, 18);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(wx + 12, wy + 3, 3, 18);
    ctx.fillRect(wx + 3, wy + 11, 20, 3);
  }

  // дверь
  const doorW = 26;
  const doorH = 36;
  ctx.fillStyle = '#3f2714';
  ctx.fillRect(x - doorW / 2, y - doorH, doorW, doorH);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - doorW / 2 + 3, y - doorH + 3, doorW - 6, doorH - 3);
  ctx.fillStyle = '#e8c85a';
  ctx.fillRect(x + doorW / 2 - 9, y - doorH / 2 - 4, 3, 3);

  // вывеска
  if (o.sign) {
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(x - 36, top + 10, 72, 18);
    ctx.fillStyle = '#3f2714';
    ctx.fillRect(x - 36, top + 10, 72, 2);
    ctx.fillStyle = '#3f2714';
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(o.sign, x, top + 23);
    ctx.textAlign = 'left';
  }
}

// Кузница: каменная стена, горн с огнём, труба и наковальня.
function drawForge(o) {
  const w = o.w;
  const h = o.h;
  const x = o.x;
  const y = o.y;
  const left = x - w / 2;
  const top = y - h;
  shadow(x, y + 2, w * 0.52, 9);

  ctx.fillStyle = '#8a8a84';
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = '#7a7a74';
  for (let i = 0; i < 5; i++) ctx.fillRect(left, top + i * (h / 5), w, 2);

  ctx.fillStyle = '#4a4a52';
  ctx.beginPath();
  ctx.moveTo(left - 12, top + 2);
  ctx.lineTo(x, top - 38);
  ctx.lineTo(left + w + 12, top + 2);
  ctx.closePath();
  ctx.fill();

  // труба с дымом
  ctx.fillStyle = '#5a5a62';
  ctx.fillRect(x + 30, top - 56, 18, 30);
  const t = performance.now() / 800;
  for (let i = 0; i < 3; i++) {
    const k = (t + i * 0.33) % 1;
    ctx.globalAlpha = 0.3 * (1 - k);
    ctx.fillStyle = '#cfd8e0';
    ctx.beginPath();
    ctx.arc(x + 39, top - 60 - k * 30, 5 + k * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // горн
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 26, y - 44, 52, 44);
  const g = ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 34);
  g.addColorStop(0, 'rgba(255, 170, 70, 0.95)');
  g.addColorStop(0.5, 'rgba(230, 90, 30, 0.7)');
  g.addColorStop(1, 'rgba(230, 90, 30, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 34, y - 54, 68, 54);

  // наковальня
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(x - 84, y - 16, 28, 8);
  ctx.fillRect(x - 76, y - 8, 12, 8);
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(x - 86, y - 20, 32, 6);

  // вывеска
  ctx.fillStyle = '#c9b48a';
  ctx.fillRect(x - 36, top + 8, 72, 18);
  ctx.fillStyle = '#3f2714';
  ctx.fillRect(x - 36, top + 8, 72, 2);
  ctx.fillStyle = '#3f2714';
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('КУЗНИЦА', x, top + 21);
  ctx.textAlign = 'left';
}

// Колодец на площади.
function drawWell(o) {
  const x = o.x;
  const y = o.y;
  shadow(x, y + 2, 28, 8);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 22, y - 62, 4, 50);
  ctx.fillRect(x + 18, y - 62, 4, 50);
  ctx.fillStyle = '#8a5a3a';
  ctx.beginPath();
  ctx.moveTo(x - 30, y - 62);
  ctx.lineTo(x, y - 84);
  ctx.lineTo(x + 30, y - 62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(x - 20, y - 52, 40, 4);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 5, y - 46, 10, 9);

  ctx.fillStyle = '#8a8a84';
  ctx.fillRect(x - 22, y - 26, 44, 26);
  ctx.fillStyle = '#9a9a94';
  ctx.fillRect(x - 18, y - 22, 36, 18);
  ctx.fillStyle = '#3a4a5a';
  ctx.fillRect(x - 14, y - 18, 28, 12);
  ctx.fillStyle = 'rgba(140, 190, 220, 0.35)';
  ctx.fillRect(x - 10, y - 16, 8, 3);
}

// Фонарь со светящимся окошком.
function drawLantern(o) {
  const x = o.x;
  const y = o.y;
  ctx.fillStyle = '#3a3a42';
  ctx.fillRect(x - 2, y - 52, 4, 52);
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(x - 8, y - 4, 16, 4);
  ctx.fillStyle = '#2b2b33';
  ctx.fillRect(x - 7, y - 72, 14, 20);
  ctx.fillStyle = '#ffd45c';
  ctx.fillRect(x - 5, y - 69, 10, 14);
  ctx.fillStyle = '#2b2b33';
  ctx.fillRect(x - 9, y - 76, 18, 5);
  const g = ctx.createRadialGradient(x, y - 62, 2, x, y - 62, 34);
  g.addColorStop(0, 'rgba(255, 212, 92, 0.32)');
  g.addColorStop(1, 'rgba(255, 212, 92, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 34, y - 96, 68, 68);
}

function drawBench(o) {
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(o.x - 22, o.y - 12, 44, 4);
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(o.x - 20, o.y - 18, 40, 4);
  ctx.fillRect(o.x - 18, o.y - 8, 4, 8);
  ctx.fillRect(o.x + 14, o.y - 8, 4, 8);
}

function drawCrate(o) {
  const s = 22;
  ctx.fillStyle = '#a5822c';
  ctx.fillRect(o.x - s / 2, o.y - s, s, s);
  ctx.fillStyle = '#8a6a22';
  ctx.fillRect(o.x - s / 2, o.y - s, s, 3);
  ctx.fillRect(o.x - s / 2, o.y - 3, s, 3);
  ctx.strokeStyle = '#6b4a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x - s / 2 + 3, o.y - s + 3);
  ctx.lineTo(o.x + s / 2 - 3, o.y - 3);
  ctx.stroke();
}

function drawBarrel(o) {
  ctx.fillStyle = '#8a6234';
  ctx.fillRect(o.x - 9, o.y - 24, 18, 24);
  ctx.fillStyle = '#6b4a26';
  ctx.fillRect(o.x - 9, o.y - 20, 18, 3);
  ctx.fillRect(o.x - 9, o.y - 8, 18, 3);
  ctx.fillStyle = '#4a3520';
  ctx.fillRect(o.x - 9, o.y - 24, 18, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(o.x - 6, o.y - 18, 3, 8);
}

function drawFence(o) {
  const w = o.w || 80;
  ctx.fillStyle = '#8a6234';
  for (let i = 0; i <= w; i += 20) ctx.fillRect(o.x - w / 2 + i, o.y - 26, 4, 26);
  ctx.fillRect(o.x - w / 2, o.y - 20, w, 3);
  ctx.fillRect(o.x - w / 2, o.y - 10, w, 3);
}

// Ворота города (в лес).
function drawCityGate(o) {
  const x = o.x;
  const y = o.y;
  shadow(x, y + 2, 56, 10);

  // проём
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x - 30, y - 96, 60, 96);
  ctx.beginPath();
  ctx.arc(x, y - 96, 30, Math.PI, 0);
  ctx.fill();

  // каменная рамка
  ctx.fillStyle = '#8a8a84';
  ctx.fillRect(x - 44, y - 122, 14, 122);
  ctx.fillRect(x + 30, y - 122, 14, 122);
  ctx.fillRect(x - 44, y - 126, 88, 8);
  ctx.strokeStyle = '#8a8a84';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(x, y - 96, 34, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#7a7a74';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x - 44, y - 116 + i * 24, 14, 2);
    ctx.fillRect(x + 30, y - 116 + i * 24, 14, 2);
  }

  // створки приоткрыты
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 30, y - 96, 12, 96);
  ctx.fillRect(x + 18, y - 96, 12, 96);

  // вывеска «В ЛЕС»
  ctx.fillStyle = '#c9b48a';
  ctx.fillRect(x - 28, y - 62, 56, 16);
  ctx.fillStyle = '#3f2714';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('В ЛЕС', x, y - 50);
  ctx.textAlign = 'left';
}

// Указатель на восток — дорога во вторую часть.
function drawSignpost(o) {
  const x = o.x;
  const y = o.y;
  shadow(x, y + 1, 12, 4);
  ctx.fillStyle = '#6b4a2a';
  ctx.fillRect(x - 3, y - 64, 6, 64);
  ctx.fillStyle = '#c9b48a';
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 68);
  ctx.lineTo(x + 56, y - 68);
  ctx.lineTo(x + 66, y - 58);
  ctx.lineTo(x + 56, y - 48);
  ctx.lineTo(x - 4, y - 48);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7a5530';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#3f2714';
  ctx.font = 'bold 10px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('НА ВОСТОК', x + 26, y - 55);
  ctx.textAlign = 'left';
}

// Житель города — тот же персонаж, но без купленной одежды.
function drawNpc(o) {
  shadow(o.x, o.y + 1, 11, 4);
  let dir = 'down';
  if (Math.abs(player.x - o.x) > 14) dir = player.x < o.x ? 'left' : 'right';
  drawCharacter(ctx, o.x, o.y, 3, o.def, o.eye || '#2f6fd0', dir, 0, true);
}

// Пёс Бублик, который всё время спит.
function drawDog(o) {
  const U = 3;
  const x = o.x;
  const y = o.y;
  shadow(x, y + 1, 18, 4);
  const px = (ix, iy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x - 8 * U + ix * U), Math.round(y - 6 * U + iy * U), w * U, h * U);
  };
  px(2, 3, 9, 3, '#8a5a3a'); // тело
  px(4, 5, 7, 1, '#6b4a2a'); // живот
  px(9, 1, 4, 4, '#8a5a3a'); // голова
  px(12, 1, 1, 1, '#8a5a3a'); // ухо
  px(9, 0, 1, 1, '#8a5a3a');
  px(11, 2, 1, 1, '#2b2b33'); // глаз
  px(12, 3, 1, 1, '#3f2714'); // нос
  px(1, 2, 2, 1, '#8a5a3a'); // хвост
  px(2, 5, 1, 1, '#6b4a2a'); // лапы
  px(10, 5, 1, 1, '#6b4a2a');
}

// Окно разговора с жителем.
function drawDialog() {
  if (!dialog) return;
  ctx.fillStyle = 'rgba(6, 14, 10, 0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const bw = Math.min(820, VIEW_W - 80);
  const bx = (VIEW_W - bw) / 2;
  const by = 396;
  const bh = 174;
  ctx.fillStyle = '#1c2c21';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 3;
  ctx.strokeRect(bx + 1.5, by + 1.5, bw - 3, bh - 3);

  // табличка с именем
  ctx.fillStyle = '#2f5a3c';
  ctx.fillRect(bx + 24, by - 16, 280, 28);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx + 25, by - 15, 278, 26);
  ctx.fillStyle = '#ffdf7a';
  ctx.font = 'bold 17px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(dialog.name, bx + 38, by + 4);

  // портрет говорящего
  const tx = dialog.face ? bx + 150 : bx + 40;
  if (dialog.face && NPC_DEFS[dialog.face]) {
    const nd = NPC_DEFS[dialog.face];
    shadow(bx + 78, by + 156, 24, 8);
    drawCharacter(ctx, bx + 78, by + 156, 4, nd.def, nd.eye || '#2f6fd0', 'down', 0, true);
  }

  ctx.fillStyle = '#f4e9c8';
  ctx.font = (IS_TOUCH ? 20 : 19) + 'px "Courier New", monospace';
  wrapText(dialog.lines[dialog.i], tx, by + 50, bw - (tx - bx) - 30, 27);

  ctx.fillStyle = '#7f9c86';
  ctx.font = (IS_TOUCH ? 14 : 13) + 'px "Courier New", monospace';
  ctx.textAlign = 'right';
  const nextHint =
    uiMode === 'touch'
      ? 'нажми, чтобы продолжить'
      : uiMode === 'gamepad'
        ? 'A — дальше'
        : 'E / пробел — дальше';
  ctx.fillText(nextHint + '  (' + (dialog.i + 1) + '/' + dialog.lines.length + ')', bx + bw - 24, by + bh - 14);
  ctx.textAlign = 'left';
}

function drawCat(o) {
  const U = 2;
  shadow(o.x, o.y + 1, 13, 3);
  const px = (ix, iy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(o.x - 6 * U + ix * U), Math.round(o.y - 9 * U + iy * U), w * U, h * U);
  };
  // хвост
  px(8, 5, 1, 3, '#1b1b22');
  px(9, 3, 1, 2, '#1b1b22');
  px(10, 2, 1, 2, '#1b1b22');
  // тело и голова
  px(2, 4, 6, 5, '#1b1b22');
  px(3, 2, 4, 3, '#1b1b22');
  px(3, 8, 1, 1, '#2f2f3a');
  px(6, 8, 1, 1, '#2f2f3a');
  // уши
  px(3, 1, 1, 1, '#1b1b22');
  px(6, 1, 1, 1, '#1b1b22');
  // глаза
  px(3, 3, 1, 1, '#ffd45c');
  px(5, 3, 1, 1, '#ffd45c');
  // грудка
  px(4, 6, 2, 2, '#33333f');

  if (o.lineT > 0) speechBubble(o.x, o.y - 26, o.line, 200);
}

// Баба-яга: платок, шаль, ступа и метла. При колдовстве поднимает руку с зельем.
function drawYaga(x, y) {
  const U = 4;
  const own = boss.id === 'yaga'; // анимация боя — только для самой Яги
  ctx.save();
  if (own && boss.dead) {
    const k = Math.min(1, boss.deadT * 1.8);
    ctx.translate(x, y);
    ctx.rotate(-1.35 * k);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, boss.deadT - 2.2));
    ctx.translate(-x, -y);
  } else if (own && boss.moving) {
    ctx.translate(0, Math.round(Math.sin(boss.animTime * 9)));
  }
  shadow(x, y + 2, 27, 7);
  const px = (ix, iy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x - 8 * U + ix * U), Math.round(y - 18 * U + iy * U), w * U, h * U);
  };
  const hit = boss.hurt > 0;

  // ступа
  px(2, 14, 12, 3, '#6b5a48');
  px(3, 17, 10, 1, '#4f4234');
  px(2, 13, 12, 1, '#8a7a63');

  // метла за спиной
  px(13, 4, 1, 10, '#8a6234');
  px(12, 14, 3, 4, '#b89a5a');

  // юбка и фартук
  px(4, 9, 8, 5, hit ? '#8a4a44' : '#5a2f2a');
  px(4, 11, 8, 1, '#4a2521');
  px(4, 13, 8, 1, '#3f1f1c');
  px(6, 10, 4, 4, '#d9cfc0');

  // шаль
  px(4, 7, 8, 3, hit ? '#4a7a5c' : '#2f5a3c');
  px(5, 6, 6, 1, '#2f5a3c');

  // голова и платок
  px(5, 2, 6, 5, '#dcb98f');
  px(4, 1, 8, 2, '#8a3a44');
  px(4, 3, 1, 4, '#8a3a44');
  px(11, 3, 1, 4, '#8a3a44');
  px(5, 4, 1, 2, '#d8d4c8');
  px(10, 4, 1, 2, '#d8d4c8');

  // глаза
  px(6, 4, 1, 1, '#ffd45c');
  px(9, 4, 1, 1, '#ffd45c');
  // нос крючком и рот
  px(7, 5, 2, 1, '#c9a374');
  px(8, 6, 1, 1, '#c9a374');
  px(7, 7, 2, 1, '#8a5a4a');

  // руки
  if (own && boss.castTimer > 0 && !boss.dead) {
    px(12, 6, 2, 2, '#2f5a3c');
    px(13, 4, 2, 2, '#dcb98f');
    px(13, 1, 2, 3, '#4fa054');
    px(13, 0, 2, 1, '#8a6234');
  } else {
    px(2, 8, 2, 3, '#2f5a3c');
    px(2, 10, 2, 1, '#dcb98f');
    px(12, 8, 2, 3, '#2f5a3c');
    px(12, 10, 2, 1, '#dcb98f');
  }

  // крестики вместо глаз у побеждённой
  if (own && boss.dead) {
    px(5, 3, 3, 1, '#f4e9c8');
    px(6, 2, 1, 3, '#f4e9c8');
    px(8, 3, 3, 1, '#f4e9c8');
    px(9, 2, 1, 3, '#f4e9c8');
  }
  ctx.restore();
}

// Леший: большой моховой лесовик с рогами-ветками.
function drawLeshy(x, y) {
  const U = 3;
  const own = boss.id === 'leshy'; // пока Леший просто стоит у ворот, он не «оживает»
  ctx.save();
  if (own && boss.dead) {
    const k = Math.min(1, boss.deadT * 1.8);
    ctx.translate(x, y);
    ctx.rotate(-1.2 * k);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, boss.deadT - 2.2));
    ctx.translate(-x, -y);
  } else if (own && boss.moving) {
    ctx.translate(0, Math.round(Math.sin(boss.animTime * 6) * 2));
  }
  shadow(x, y + 2, 36, 9);
  const px = (ix, iy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x - 14 * U + ix * U), Math.round(y - 32 * U + iy * U), w * U, h * U);
  };
  const hit = boss.hurt > 0;

  // ноги-коряги
  px(7, 25, 5, 7, '#4a3a24');
  px(16, 25, 5, 7, '#4a3a24');
  px(5, 31, 9, 1, '#3a2c1a');
  px(14, 31, 9, 1, '#3a2c1a');

  // туловище
  px(6, 12, 16, 14, hit ? '#6a7a3c' : '#4a5a2c');
  for (let i = 0; i < 4; i++) px(7 + i * 4, 13, 1, 12, '#5a4630');
  px(8, 20, 5, 4, '#6f9a3a');
  px(16, 15, 4, 3, '#6f9a3a');

  // руки
  if (own && boss.swing > 0) {
    px(1, 12, 5, 3, '#5a4630');
    px(22, 12, 5, 3, '#5a4630');
    px(0, 8, 3, 5, '#5a4630');
    px(25, 8, 3, 5, '#5a4630');
  } else {
    px(2, 14, 5, 3, '#5a4630');
    px(21, 14, 5, 3, '#5a4630');
    px(2, 17, 3, 8, '#5a4630');
    px(23, 17, 3, 8, '#5a4630');
  }

  // голова
  px(9, 4, 10, 9, '#5a6a34');
  px(9, 4, 10, 1, '#3f4a22');

  // глаза светятся
  px(11, 7, 2, 2, '#a8ff6a');
  px(15, 7, 2, 2, '#a8ff6a');
  px(11, 7, 1, 1, '#0e1a08');
  px(16, 7, 1, 1, '#0e1a08');

  // рот и борода из мха
  px(12, 10, 4, 2, '#1a2410');
  px(9, 12, 10, 3, '#3f5a24');
  px(10, 15, 3, 2, '#3f5a24');
  px(15, 15, 3, 2, '#3f5a24');

  if (own && boss.dead) {
    px(10, 6, 4, 1, '#f4e9c8');
    px(11, 5, 1, 3, '#f4e9c8');
    px(14, 6, 4, 1, '#f4e9c8');
    px(15, 5, 1, 3, '#f4e9c8');
  }

  // рога-ветки — поверх головы, чтобы их было видно
  px(6, -1, 2, 8, '#6b5234');
  px(4, 1, 3, 2, '#6b5234');
  px(5, 4, 3, 2, '#6b5234');
  px(20, -1, 2, 8, '#6b5234');
  px(21, 1, 3, 2, '#6b5234');
  px(20, 4, 3, 2, '#6b5234');
  ctx.restore();
}

// Круги-предупреждения и вылезающие корни Лешего.
function drawRoots() {
  for (const r of roots) {
    if (r.t < r.delay) {
      const k = r.t / r.delay;
      ctx.fillStyle = 'rgba(150, 70, 45, ' + (0.12 + 0.12 * k).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 46, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 208, 138, ' + (0.35 + 0.55 * k).toFixed(2) + ')';
      ctx.lineWidth = 2 + k * 2;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, 46 * (1 - 0.15 * (1 - k)), 30 * (1 - 0.15 * (1 - k)), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const k = Math.min(1, (r.t - r.delay) / 0.12);
      ctx.globalAlpha = Math.max(0, 1 - (r.t - r.delay) / r.life);
      for (let i = 0; i < 5; i++) {
        const off = (i - 2) * 9;
        const hgt = (26 + (i % 2) * 12) * k;
        const lean = (i - 2) * 3;
        ctx.fillStyle = i % 2 ? '#5a3a20' : '#6b4a2a';
        ctx.beginPath();
        ctx.moveTo(r.x + off - 6, r.y);
        ctx.lineTo(r.x + off + lean, r.y - hgt);
        ctx.lineTo(r.x + off + 6, r.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}

// Брызги зелья и дым от телепорта.
function drawSplashes() {
  for (const s of splashes) {
    const k = s.t / s.dur;
    ctx.globalAlpha = Math.max(0, 1 - k);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.r * (0.35 + 0.75 * k), s.r * (0.35 + 0.75 * k) * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + s.t * 4;
      const d = s.r * (0.4 + 0.7 * k);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d * 0.6, 3, 3);
    }
    ctx.globalAlpha = 1;
  }
}

// Летящие зелья Бабы-яги (с тенью на земле).
function drawPotionsWorld() {
  for (const p of potions) {
    const k = Math.min(1, p.t / p.dur);
    const x = p.x + (p.tx - p.x) * k;
    const y = p.y + (p.ty - p.y) * k;
    const lift = Math.sin(Math.PI * k) * 52;
    shadow(x, y, 8, 3);
    const by = y - lift;
    ctx.fillStyle = '#cfe3d2';
    ctx.fillRect(x - 4, by - 14, 8, 10);
    ctx.fillStyle = '#4fa054';
    ctx.fillRect(x - 3, by - 8, 6, 4);
    ctx.fillStyle = '#8a6234';
    ctx.fillRect(x - 3, by - 17, 6, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x - 2, by - 12, 2, 3);
  }
}

// Реплика босса над головой.
function drawBossSpeech() {
  if (!boss.id || boss.lineT <= 0 || !boss.line) return;
  const h = boss.id === 'yaga' ? 96 : 132;
  speechBubble(boss.x, boss.y - h, boss.line, 240);
}

function drawPlayer() {
  shadow(player.x, player.y + 1, 11, 4);
  let frame = 0;
  if (player.moving) {
    const phase = Math.floor(player.animTime * 8) % 4;
    frame = phase === 1 ? 1 : phase === 3 ? 2 : 0;
  }
  // после укуса персонаж мигает
  if (player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.4;
  drawCharacter(ctx, player.x, player.y, 3, CHARACTERS[selChar], EYE_COLORS[selEye].color, player.dir, frame);
  ctx.globalAlpha = 1;
  if (hasBow()) drawHeldBow();
}

// Лук в руках персонажа — маленькая дуга сбоку.
function drawHeldBow() {
  const side = player.dir === 'left' ? -1 : 1;
  const x = player.x + side * 12;
  const y = player.y - 22;
  const crystal = hasCrystalBow();
  ctx.strokeStyle = crystal ? '#a45de0' : '#8a6234';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 9, -Math.PI / 2 - side * 1.1, Math.PI / 2 - side * 1.1, side < 0);
  ctx.stroke();
  ctx.strokeStyle = '#e8e0cf';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + side * -1, y - 9);
  ctx.lineTo(x + side * -1, y + 9);
  ctx.stroke();
}

// Полоска здоровья босса — снизу по центру, над инвентарём.
function drawBossBar() {
  if (!boss.active && !boss.dead) return;
  const def = BOSSES[boss.id] || BOSSES.yaga;
  const w = 380;
  const h = 42;
  const x = (VIEW_W - w) / 2;
  const y = VIEW_H - 118;
  ctx.fillStyle = 'rgba(12, 26, 18, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = boss.phase === 2 ? '#ff9a8a' : '#f4e9c8';
  ctx.font = 'bold ' + (IS_TOUCH ? 15 : 13) + 'px "Courier New", monospace';
  ctx.fillText(def.name + (boss.phase === 2 ? ' · В ЯРОСТИ' : ''), x + 10, y + 17);
  drawBar(x + 10, y + 22, w - 20, 14, boss.hp, boss.maxHp, '#c0392b', '');
  ctx.textAlign = 'center';
}

// Полоска: рамка, тёмный «жёлоб» и заполнение.
function drawBar(x, y, w, h, value, max, color, label) {
  ctx.fillStyle = '#12211a';
  ctx.fillRect(x, y, w, h);
  const filled = Math.max(0, Math.min(1, value / max));
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.round((w - 4) * filled), h - 4);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x + 2, y + 2, Math.round((w - 4) * filled), 2);
  ctx.strokeStyle = '#4a6b52';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold ' + (IS_TOUCH ? 14 : 11) + 'px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 6, y + h - 4);
  ctx.textAlign = 'right';
  ctx.fillText(Math.ceil(value) + '/' + max, x + w - 6, y + h - 4);
  ctx.textAlign = 'left';
}

function drawHud() {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(12, 26, 18, 0.72)';
  ctx.fillRect(12, 12, 260, 94);
  ctx.strokeStyle = '#4a6b52';
  ctx.lineWidth = 2;
  ctx.strokeRect(13, 13, 258, 92);

  drawCharacter(ctx, 36, 52, 2, CHARACTERS[selChar], EYE_COLORS[selEye].color, 'down', 0);
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold ' + (IS_TOUCH ? 15 : 14) + 'px "Courier New", monospace';
  ctx.fillText(CHARACTERS[selChar].name, 58, 32);
  ctx.fillStyle = '#9dbfa4';
  ctx.font = (IS_TOUCH ? 13 : 12) + 'px "Courier New", monospace';
  ctx.fillText('глаза: ' + EYE_COLORS[selEye].name, 58, 48);

  drawBar(22, 60, 240, 18, player.hp, MAX_HP, '#d24a44', 'ЗДОРОВЬЕ');
  const starving = player.hunger <= 0;
  const low = player.hunger < 25;
  drawBar(22, 82, 240, 18, player.hunger, MAX_HUNGER, starving ? '#8a5a2a' : low ? '#e0762c' : '#e0a83c', 'ГОЛОД');

  // оружие: сколько стрел осталось
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(12, 26, 18, 0.72)';
  ctx.fillRect(12, 110, 150, 34);
  ctx.strokeStyle = '#4a6b52';
  ctx.lineWidth = 2;
  ctx.strokeRect(13, 111, 148, 32);
  if (hasBow()) {
    drawItemIcon(ctx, 'arrow', 18, 114, 26);
    ctx.fillStyle = invCount('arrow') ? (hasCrystalBow() ? '#e0bcff' : '#f4e9c8') : '#ff9a8a';
    ctx.font = 'bold ' + (IS_TOUCH ? 16 : 14) + 'px "Courier New", monospace';
    ctx.fillText('стрелы: ' + invCount('arrow'), 48, 133);
  } else {
    ctx.fillStyle = '#9dbfa4';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(
      uiMode === 'touch'
        ? 'лука нет — КРАФТ'
        : uiMode === 'gamepad'
          ? 'лука нет — LT'
          : 'лука пока нет (C)',
      20,
      133
    );
  }

  // алмазики — валюта для лавки одежды
  ctx.fillStyle = 'rgba(12, 26, 18, 0.72)';
  ctx.fillRect(12, 152, 132, 30);
  ctx.strokeStyle = '#4a6b52';
  ctx.lineWidth = 2;
  ctx.strokeRect(13, 153, 130, 28);
  drawItemIcon(ctx, 'diamond', 17, 156, 22);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#bff0ff';
  ctx.font = 'bold ' + (IS_TOUCH ? 16 : 14) + 'px "Courier New", monospace';
  ctx.fillText(String(progress.diamonds), 46, 174);

  const warn = [];
  if (starving) warn.push('Ты голодаешь! Скорее найди еду!');
  else if (low) warn.push('Хочется есть — поищи еду');
  const wolves = enemies.filter((e) => e.kind === 'wolf').length;
  const bats = enemies.filter((e) => e.kind === 'bat').length;
  if (wolves) warn.push('Волки рядом: ' + wolves + '!');
  if (bats) warn.push('Летучие мыши: ' + bats + '!');
  if (player.poison > 0) warn.push('Яд! −1 HP каждую секунду');
  ctx.textAlign = 'center';
  ctx.font = 'bold ' + (IS_TOUCH ? 17 : 15) + 'px "Courier New", monospace';
  if (Math.sin(performance.now() / 220) > -0.3) {
    warn.forEach((text, i) => {
      ctx.fillStyle = i === 0 && (starving || low) ? (starving ? '#ff9a8a' : '#ffd08a') : '#ff9a8a';
      ctx.fillText(text, VIEW_W / 2, 34 + i * 20);
    });
  }

  drawClock();
  drawBossBar();

  // Подсказки по управлению. На телефоне вместо них — экранные кнопки.
  if (uiMode !== 'touch') {
    const hints =
      uiMode === 'gamepad'
        ? [
            'Стик / крест — ходить',
            'A — действие, X / RT — выстрел',
            'Y — предмет, LB / RB — слот',
            'LT — крафт, B — назад',
            'Start / Back — меню и помощь',
          ]
        : [
            'WASD / стрелки — ходить',
            'E / пробел — действие',
            'мышь / F — стрелять',
            'C — крафт, 1–0 — предмет',
            'H — помощь, Esc — меню',
          ];
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(12, 26, 18, 0.6)';
    ctx.fillRect(VIEW_W - 262, 68, 250, 96);
    ctx.fillStyle = '#cfe3d2';
    ctx.font = '12px "Courier New", monospace';
    hints.forEach((text, i) => ctx.fillText(text, VIEW_W - 22, 86 + i * 16));
    ctx.textAlign = 'center';
  }
}

// Часы: номер дня, время суток и солнышко/луна.
function drawClock() {
  const x = VIEW_W - 262;
  const y = 12;
  ctx.fillStyle = 'rgba(12, 26, 18, 0.72)';
  ctx.fillRect(x, y, 250, 48);
  ctx.strokeStyle = '#4a6b52';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, 248, 46);

  const d = darkness();
  const cx = x + 28;
  const cy = y + 24;
  if (d < 0.5) {
    ctx.fillStyle = '#ffd45c';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd45c';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13);
      ctx.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#e8eaf5';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(12, 26, 18, 1)';
    ctx.beginPath();
    ctx.arc(cx + 5, cy - 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4e9c8';
    ctx.fillRect(cx + 14, cy - 12, 2, 2);
    ctx.fillRect(cx + 20, cy + 4, 2, 2);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold ' + (IS_TOUCH ? 16 : 14) + 'px "Courier New", monospace';
  ctx.fillText('День ' + clock.day + ' — ' + phaseName(), x + 52, y + 22);
  if (world.kind === 'cave') {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cfa6f5';
    ctx.font = 'bold ' + (IS_TOUCH ? 13 : 12) + 'px "Courier New", monospace';
    ctx.fillText('ПЕЩЕРА ' + world.level, x + 240, y + 22);
    ctx.textAlign = 'left';
  }

  // полоска суток: где мы внутри дня
  ctx.fillStyle = '#12211a';
  ctx.fillRect(x + 52, y + 30, 180, 8);
  ctx.fillStyle = d > 0.45 ? '#5f6fbf' : '#e0a83c';
  ctx.fillRect(x + 53, y + 31, Math.round(178 * (clock.t / DAY_LEN)), 6);
  ctx.strokeStyle = '#4a6b52';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 52.5, y + 30.5, 179, 7);
}

/* ------------------------------ Инвентарь -------------------------------- */

const INV = { size: IS_TOUCH ? 52 : 46, gap: 6 };
INV.y = VIEW_H - INV.size - (IS_TOUCH ? 8 : 14);
INV.x0 = (VIEW_W - (INV.size * INV_SLOTS + INV.gap * (INV_SLOTS - 1))) / 2;

function slotRect(i) {
  return { x: INV.x0 + i * (INV.size + INV.gap), y: INV.y, w: INV.size, h: INV.size };
}

// В какой слот попала мышка (или -1).
function slotAt(x, y) {
  for (let i = 0; i < INV_SLOTS; i++) {
    if (hit(slotRect(i), x, y)) return i;
  }
  return -1;
}

function drawInventory() {
  const hovered = slotAt(mouse.x, mouse.y);
  const selected = uiMode === 'gamepad' ? selectedSlot : -1;
  const iconSize = INV.size - 14;
  for (let i = 0; i < INV_SLOTS; i++) {
    const r = slotRect(i);
    const slot = inventory[i];
    ctx.fillStyle = 'rgba(12, 26, 18, 0.8)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = i === selected ? 3 : 2;
    ctx.strokeStyle = i === selected ? '#ffd45c' : i === hovered && slot ? '#f4e9c8' : '#4a6b52';
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

    // номер клавиши в уголке (на телефоне он не нужен)
    if (uiMode !== 'touch') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6f8f77';
      ctx.font = '10px "Courier New", monospace';
      ctx.fillText(String(i === 9 ? 0 : i + 1), r.x + 4, r.y + 12);
    }

    if (!slot) continue;
    drawItemIcon(ctx, slot.id, r.x + 7, r.y + 7, iconSize);
    if (slot.count > 1) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1d3222';
      ctx.font = 'bold ' + (IS_TOUCH ? 14 : 13) + 'px "Courier New", monospace';
      ctx.fillText(String(slot.count), r.x + r.w - 4, r.y + r.h - 3);
      ctx.fillStyle = '#f4e9c8';
      ctx.fillText(String(slot.count), r.x + r.w - 5, r.y + r.h - 4);
    }
  }

  // подпись предмета под курсором/выбранного геймпадом слота
  const shown = uiMode === 'gamepad' ? selected : hovered;
  ctx.textAlign = 'center';
  if (shown >= 0 && inventory[shown]) {
    const item = ITEMS[inventory[shown].id];
    const action = item.hunger
      ? ' (съесть)'
      : item.heal || item.poison
        ? ' (выпить)'
        : item.place
          ? ' (поставить)'
          : '';
    const hint = uiMode === 'gamepad' ? ' · Y — использовать' : '';
    ctx.fillStyle = '#f4e9c8';
    ctx.font = (IS_TOUCH ? 16 : 15) + 'px "Courier New", monospace';
    ctx.fillText(item.name + action + hint, VIEW_W / 2, INV.y - 10);
  } else if (inventory.length === 0) {
    ctx.fillStyle = '#9dbfa4';
    ctx.font = (IS_TOUCH ? 14 : 13) + 'px "Courier New", monospace';
    ctx.fillText(
      uiMode === 'touch'
        ? 'Инвентарь пуст — собирай палки, листья и еду кнопкой «ДЕЙСТВИЕ»'
        : 'Инвентарь пуст — собирай палки, листья, уголь и еду (E)',
      VIEW_W / 2,
      INV.y - 10
    );
  }
}

/* -------------------------------- Крафт ---------------------------------- */

const CRAFT = { w: 470, h: 60 + RECIPES.length * 74 + 26 };
CRAFT.x = (VIEW_W - CRAFT.w) / 2;
CRAFT.y = 30;
const CRAFT_CLOSE = { x: CRAFT.x + CRAFT.w - 50, y: CRAFT.y + 8, w: 38, h: 38 };
let craftSel = 0;

function recipeRect(i) {
  return { x: CRAFT.x + 16, y: CRAFT.y + 52 + i * 74, w: CRAFT.w - 32, h: 66 };
}

function updateCraftPanel() {
  if (!mouse.clicked) return;
  mouse.clicked = false;
  if (hit(CRAFT_CLOSE, mouse.x, mouse.y)) {
    craftOpen = false;
    return;
  }
  for (let i = 0; i < RECIPES.length; i++) {
    if (hit(recipeRect(i), mouse.x, mouse.y)) {
      craftSel = i;
      craft(RECIPES[i]);
      return;
    }
  }
}

function drawCraftPanel() {
  ctx.fillStyle = 'rgba(6, 14, 9, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = '#1c2c21';
  ctx.fillRect(CRAFT.x, CRAFT.y, CRAFT.w, CRAFT.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f4e9c8';
  ctx.strokeRect(CRAFT.x + 1.5, CRAFT.y + 1.5, CRAFT.w - 3, CRAFT.h - 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText('КРАФТ', CRAFT.x + CRAFT.w / 2, CRAFT.y + 34);

  // крестик закрытия — удобен мышкой и пальцем
  const closeHover = hit(CRAFT_CLOSE, mouse.x, mouse.y);
  ctx.fillStyle = closeHover ? '#6b3a3a' : '#2c4733';
  ctx.fillRect(CRAFT_CLOSE.x, CRAFT_CLOSE.y, CRAFT_CLOSE.w, CRAFT_CLOSE.h);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(CRAFT_CLOSE.x + 1, CRAFT_CLOSE.y + 1, CRAFT_CLOSE.w - 2, CRAFT_CLOSE.h - 2);
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillText('×', CRAFT_CLOSE.x + CRAFT_CLOSE.w / 2, CRAFT_CLOSE.y + 27);

  for (let i = 0; i < RECIPES.length; i++) {
    const rec = RECIPES[i];
    const r = recipeRect(i);
    const ok = canCraft(rec);
    const hovered = hit(r, mouse.x, mouse.y);
    const focused = i === craftSel && uiMode !== 'touch';

    ctx.fillStyle = ok ? (hovered ? '#3b5f43' : '#2c4733') : '#25322a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = focused ? 3 : 2;
    ctx.strokeStyle = focused ? '#ffd45c' : ok ? '#7bbd63' : '#44554b';
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

    // «ингредиент + ингредиент = предмет»
    let x = r.x + 12;
    const y = r.y + 15;
    ctx.textAlign = 'center';
    const entries = Object.entries(rec.need);
    entries.forEach(([id, n], k) => {
      drawItemIcon(ctx, id, x, y, 32);
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.fillStyle = invCount(id) >= n ? '#a6e07a' : '#ff9a8a';
      ctx.fillText(invCount(id) + '/' + n, x + 16, y + 45);
      x += 42;
      if (k < entries.length - 1) {
        ctx.fillStyle = '#cfe3d2';
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillText('+', x, y + 24);
        x += 18;
      }
    });
    ctx.fillStyle = '#cfe3d2';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.fillText('=', x, y + 24);
    x += 20;
    drawItemIcon(ctx, rec.out, x, y, 32);

    ctx.textAlign = 'left';
    ctx.fillStyle = ok ? '#f4e9c8' : '#9dbfa4';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(ITEMS[rec.out].name, x + 44, y + 16);
    ctx.fillStyle = '#8fae96';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText(rec.note, x + 44, y + 35);
    if (ok) {
      const noRoom = invCount(rec.out) === 0 && inventory.length >= INV_SLOTS;
      ctx.fillStyle = noRoom ? '#ff9a8a' : '#a6e07a';
      ctx.font = '13px "Courier New", monospace';
      ctx.fillText(noRoom ? 'инвентарь полон — съешь или поставь что-нибудь' : 'нажми, чтобы скрафтить', x + 44, y + 52);
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7f9c86';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText(craftFooter(), CRAFT.x + CRAFT.w / 2, CRAFT.y + CRAFT.h - 12);
}

function craftFooter() {
  if (uiMode === 'touch') return 'Нажми рецепт · × — закрыть';
  if (uiMode === 'gamepad') return 'Стик — выбор · A — скрафтить · B — закрыть';
  return '↑ ↓ — выбор · Enter — скрафтить · C / Esc — закрыть';
}

/* ------------------------------ Лавка одежды ------------------------------ */

const SHOP = { w: 580, h: 464 };
SHOP.x = (VIEW_W - SHOP.w) / 2;
SHOP.y = (VIEW_H - SHOP.h) / 2;

const SHOP_CARD = { w: 262, h: 108, gapX: 16, gapY: 12 };
const SHOP_CLOSE = { x: SHOP.x + SHOP.w - 52, y: SHOP.y + 8, w: 38, h: 38 };
let shopSel = 0;

function shopCardRect(i) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  return {
    x: SHOP.x + 20 + col * (SHOP_CARD.w + SHOP_CARD.gapX),
    y: SHOP.y + 92 + row * (SHOP_CARD.h + SHOP_CARD.gapY),
    w: SHOP_CARD.w,
    h: SHOP_CARD.h,
  };
}

function updateShop() {
  if (!mouse.clicked) return;
  mouse.clicked = false;
  if (hit(SHOP_CLOSE, mouse.x, mouse.y)) {
    shopOpen = false;
    return;
  }
  for (let i = 0; i < CLOTHES.length; i++) {
    if (hit(shopCardRect(i), mouse.x, mouse.y)) {
      shopSel = i;
      shopClick(CLOTHES[i]);
      return;
    }
  }
  // клик мимо панели — закрыть лавку
  if (
    mouse.x < SHOP.x ||
    mouse.x > SHOP.x + SHOP.w ||
    mouse.y < SHOP.y ||
    mouse.y > SHOP.y + SHOP.h
  ) {
    shopOpen = false;
  }
}

function drawShop() {
  ctx.fillStyle = 'rgba(6, 14, 9, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = '#1c2c21';
  ctx.fillRect(SHOP.x, SHOP.y, SHOP.w, SHOP.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f4e9c8';
  ctx.strokeRect(SHOP.x + 1.5, SHOP.y + 1.5, SHOP.w - 3, SHOP.h - 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText('ЛАВКА ОДЕЖДЫ', SHOP.x + SHOP.w / 2, SHOP.y + 34);

  // крестик закрытия
  const closeHover = hit(SHOP_CLOSE, mouse.x, mouse.y);
  ctx.fillStyle = closeHover ? '#6b3a3a' : '#2c4733';
  ctx.fillRect(SHOP_CLOSE.x, SHOP_CLOSE.y, SHOP_CLOSE.w, SHOP_CLOSE.h);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 2;
  ctx.strokeRect(SHOP_CLOSE.x + 1, SHOP_CLOSE.y + 1, SHOP_CLOSE.w - 2, SHOP_CLOSE.h - 2);
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillText('×', SHOP_CLOSE.x + SHOP_CLOSE.w / 2, SHOP_CLOSE.y + 27);

  // сколько алмазиков в кармане
  drawItemIcon(ctx, 'diamond', SHOP.x + SHOP.w - 142, SHOP.y + 14, 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#bff0ff';
  ctx.font = 'bold 17px "Courier New", monospace';
  ctx.fillText(String(progress.diamonds), SHOP.x + SHOP.w - 110, SHOP.y + 35);

  for (let i = 0; i < CLOTHES.length; i++) {
    const item = CLOTHES[i];
    const r = shopCardRect(i);
    const owned = !!progress.owned[item.id];
    const worn = !!progress.worn[item.id];
    const hovered = hit(r, mouse.x, mouse.y);
    const focused = i === shopSel && uiMode !== 'touch';
    const afford = progress.diamonds >= item.price;

    ctx.fillStyle = worn ? '#3b5f43' : owned ? '#2c4733' : hovered ? '#33443a' : '#25322a';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = focused ? 3 : worn ? 3 : 2;
    ctx.strokeStyle = focused
      ? '#f4e9c8'
      : worn
        ? '#ffd45c'
        : owned
          ? '#7bbd63'
          : hovered
            ? '#f4e9c8'
            : '#44554b';
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

    drawItemIcon(ctx, item.id, r.x + 12, r.y + 22, 40);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4e9c8';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(item.name, r.x + 64, r.y + 30);
    ctx.fillStyle = '#8fae96';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText(item.note, r.x + 64, r.y + 49);

    ctx.font = 'bold 14px "Courier New", monospace';
    const tap = uiMode === 'keyboard' ? 'клик' : 'нажми';
    if (worn) {
      ctx.fillStyle = '#ffd45c';
      ctx.fillText('надета · ' + tap + ' — снять', r.x + 64, r.y + 78);
    } else if (owned) {
      ctx.fillStyle = '#a6e07a';
      ctx.fillText('в шкафу · ' + tap + ' — надеть', r.x + 64, r.y + 78);
    } else {
      ctx.fillStyle = afford ? '#bff0ff' : '#ff9a8a';
      ctx.fillText(item.price + ' ♦ · ' + (afford ? 'купить' : 'не хватает'), r.x + 64, r.y + 78);
    }
    if (!owned) drawItemIcon(ctx, 'diamond', r.x + r.w - 38, r.y + 12, 22);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#7f9c86';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText(shopFooter(), SHOP.x + SHOP.w / 2, SHOP.y + SHOP.h - 14);
  ctx.textAlign = 'left';
}

function shopFooter() {
  if (uiMode === 'touch') return 'Нажми вещь · × — выйти · алмазики дают за боссов';
  if (uiMode === 'gamepad') return 'Стик — выбор · A — купить/надеть · B — выйти';
  return 'Алмазики — за боссов · Enter — купить · Esc — выйти';
}

// Экран поражения: от голода или от зубов врагов.
function drawFaint() {
  drawPlay();
  ctx.fillStyle = 'rgba(8, 16, 11, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const starved = faintReason.indexOf('голод') >= 0;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4e9c8';
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.fillText(starved ? 'ТЫ ОБЕССИЛЕЛ ОТ ГОЛОДА' : 'ТЫ ПРОИГРАЛ БОЙ', VIEW_W / 2, VIEW_H / 2 - 56);
  ctx.fillStyle = '#ffd08a';
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText(faintReason, VIEW_W / 2, VIEW_H / 2 - 28);
  ctx.fillStyle = '#9dbfa4';
  ctx.fillText('Съедено еды: ' + player.eaten + ' · Побеждено врагов: ' + player.defeated, VIEW_W / 2, VIEW_H / 2 - 2);
  ctx.fillText(
    starved ? 'В следующий раз ешь яблоки, бананы и овощи почаще' : 'Стреляй издалека и не подпускай врагов близко',
    VIEW_W / 2,
    VIEW_H / 2 + 22
  );

  const button = (r, label, main) => {
    ctx.fillStyle = main
      ? hit(r, mouse.x, mouse.y)
        ? '#7bbd63'
        : '#5d9a4c'
      : hit(r, mouse.x, mouse.y)
        ? '#3b5f43'
        : '#2c4733';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f4e9c8';
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    ctx.fillStyle = main ? '#12240f' : '#f4e9c8';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText(label, r.x + r.w / 2, r.y + 33);
  };
  button(RETRY_BTN, 'НАЧАТЬ ЗАНОВО', true);
  button(CHANGE_BTN, 'СМЕНИТЬ ГЕРОЯ', false);

  ctx.fillStyle = '#7f9c86';
  ctx.font = (IS_TOUCH ? 15 : 13) + 'px "Courier New", monospace';
  ctx.fillText(
    uiMode === 'touch'
      ? 'Можно начать заново или выбрать другого героя'
      : uiMode === 'gamepad'
        ? 'A — заново · B — выбрать другого героя'
        : 'Enter — заново · Esc — выбрать другого персонажа',
    VIEW_W / 2,
    RETRY_BTN.y + 84
  );
}

const RETRY_BTN = { x: VIEW_W / 2 - 248, y: VIEW_H / 2 + 50, w: 240, h: 50 };
const CHANGE_BTN = { x: VIEW_W / 2 + 8, y: VIEW_H / 2 + 50, w: 240, h: 50 };

function updateFaint() {
  if (!mouse.clicked) return;
  mouse.clicked = false;
  if (hit(RETRY_BTN, mouse.x, mouse.y)) startGame();
  else if (hit(CHANGE_BTN, mouse.x, mouse.y)) {
    state = 'select';
    mouse.clicked = false;
  }
}

/* ----------------------- Финал первой части (город) ----------------------- */

const FIN_BACK = { x: VIEW_W / 2 - 262, y: 452, w: 250, h: 50 };
const FIN_RESTART = { x: VIEW_W / 2 + 12, y: 452, w: 250, h: 50 };

// Староста рассказал про восточную дорогу — первая часть пройдена.
function finishGame() {
  state = 'win';
  craftOpen = false;
  shopOpen = false;
  dialog = null;
  sleep.active = false;
  player.moving = false;
  mouse.clicked = false;
  floaters.length = 0;
}

function drawWin() {
  drawPlay();
  ctx.fillStyle = 'rgba(6, 14, 10, 0.86)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdf7a';
  ctx.font = 'bold 34px "Courier New", monospace';
  ctx.fillText('ЧАСТЬ 1 ПРОЙДЕНА', VIEW_W / 2, 92);
  ctx.fillStyle = '#cfe3d2';
  ctx.font = '15px "Courier New", monospace';
  ctx.fillText('Ты выбрался из леса и побывал в городе Зелёный Бор', VIEW_W / 2, 120);

  // персонаж с купленной одеждой
  ctx.fillStyle = 'rgba(47, 93, 58, 0.85)';
  ctx.beginPath();
  ctx.ellipse(VIEW_W / 2, 296, 70, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  drawCharacter(ctx, VIEW_W / 2, 296, 6, CHARACTERS[selChar], EYE_COLORS[selEye].color, 'down', 0);

  ctx.fillStyle = '#9dbfa4';
  ctx.font = '14px "Courier New", monospace';
  ctx.fillText(
    'Дней в лесу: ' + clock.day + ' · Съедено еды: ' + player.eaten + ' · Побеждено врагов: ' + player.defeated,
    VIEW_W / 2,
    354
  );
  drawItemIcon(ctx, 'diamond', VIEW_W / 2 - 74, 366, 20);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#bff0ff';
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.fillText('алмазиков: ' + progress.diamonds, VIEW_W / 2 - 44, 381);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#8fae96';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText('Продолжение — за восточной заставой. Вторая часть ещё пишется.', VIEW_W / 2, 408);

  // две кнопки: вернуться в город или начать заново
  const btn = (r, label, main) => {
    ctx.fillStyle = main ? (hit(r, mouse.x, mouse.y) ? '#7bbd63' : '#5d9a4c') : hit(r, mouse.x, mouse.y) ? '#3b5f43' : '#2c4733';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f4e9c8';
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    ctx.fillStyle = main ? '#12240f' : '#f4e9c8';
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText(label, r.x + r.w / 2, r.y + 33);
  };
  btn(FIN_BACK, 'В ГОРОД', true);
  btn(FIN_RESTART, 'СЫГРАТЬ СНОВА', false);

  ctx.fillStyle = '#7f9c86';
  ctx.font = (IS_TOUCH ? 15 : 13) + 'px "Courier New", monospace';
  ctx.fillText(
    uiMode === 'touch'
      ? 'Нажми кнопку — можно вернуться в город или сыграть заново'
      : uiMode === 'gamepad'
        ? 'A — вернуться в город · X — сыграть заново · B — выбрать героя'
        : 'Enter — вернуться в город · R — заново · Esc — выбрать персонажа',
    VIEW_W / 2,
    534
  );
}

function backToCity() {
  state = 'play';
  player.invuln = 1.2;
  player.moving = false;
  mouse.clicked = false;
}

function updateWin() {
  if (!mouse.clicked) return;
  mouse.clicked = false;
  if (hit(FIN_BACK, mouse.x, mouse.y)) backToCity();
  else if (hit(FIN_RESTART, mouse.x, mouse.y)) startGame();
}

/* --------------------- Экран победы над боссом ---------------------------- */

const VICT_BTN = { x: VIEW_W / 2 - 130, y: 434, w: 260, h: 48 };

// Пятиконечная звезда: закрашенная — заработана, серая — нет.
function drawStar(cx, cy, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.46 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd45c' : 'rgba(90, 104, 90, 0.45)';
  ctx.fill();
  ctx.strokeStyle = filled ? '#b8860b' : '#3f4a3f';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (filled) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy - r * 0.26, Math.max(1, r * 0.15), 0, Math.PI * 2);
    ctx.fill();
  }
}

// Портрет Бабы-яги: та же старуха, но с крестиками вместо глаз.
function drawYagaPortrait(cx, cy, U) {
  const px = (ix, iy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(cx + (ix - 8) * U), Math.round(cy + (iy - 15) * U), w * U, h * U);
  };
  // плечи и шаль
  px(2, 12, 12, 4, '#2f5a3c');
  px(3, 12, 10, 1, '#3f7050');
  // голова
  px(4, 3, 8, 9, '#dcb98f');
  px(4, 11, 8, 1, '#cfa87c');
  // платок
  px(3, 1, 10, 2, '#8a3a44');
  px(3, 1, 10, 1, '#a54a54');
  px(3, 2, 1, 7, '#8a3a44');
  px(12, 2, 1, 7, '#8a3a44');
  // седые пряди
  px(4, 4, 1, 5, '#d8d4c8');
  px(11, 4, 1, 5, '#d8d4c8');
  // крестики вместо глаз
  px(5, 5, 3, 1, '#3a2a20');
  px(6, 6, 1, 1, '#3a2a20');
  px(5, 7, 3, 1, '#3a2a20');
  px(9, 5, 3, 1, '#3a2a20');
  px(10, 6, 1, 1, '#3a2a20');
  px(9, 7, 3, 1, '#3a2a20');
  // нос крючком, бородавка и рот
  px(7, 8, 2, 2, '#c9a374');
  px(8, 10, 1, 1, '#c9a374');
  px(9, 8, 1, 1, '#b08a62');
  px(7, 11, 2, 1, '#8a5a4a');
}

// Портрет Лешего: рога-ветки, мох, светящиеся крестики вместо глаз.
function drawLeshyPortrait(cx, cy, U) {
  const px = (ix, iy, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(cx + (ix - 8) * U), Math.round(cy + (iy - 15) * U), w * U, h * U);
  };
  // рога
  px(4, -1, 1, 5, '#6b5234');
  px(3, 0, 2, 1, '#6b5234');
  px(3, 3, 2, 1, '#6b5234');
  px(11, -1, 1, 5, '#6b5234');
  px(11, 0, 2, 1, '#6b5234');
  px(11, 3, 2, 1, '#6b5234');
  // плечи
  px(2, 13, 12, 3, '#4a5a2c');
  // голова
  px(4, 3, 8, 10, '#5a6a34');
  px(4, 3, 8, 1, '#3f4a22');
  px(4, 3, 1, 10, '#6f7f42');
  // борода из мха
  px(4, 12, 8, 3, '#3f5a24');
  px(5, 14, 2, 2, '#3f5a24');
  px(9, 14, 2, 2, '#3f5a24');
  // крестики глаз
  px(5, 5, 3, 1, '#a8ff6a');
  px(6, 6, 1, 1, '#a8ff6a');
  px(5, 7, 3, 1, '#a8ff6a');
  px(9, 5, 3, 1, '#a8ff6a');
  px(10, 6, 1, 1, '#a8ff6a');
  px(9, 7, 3, 1, '#a8ff6a');
  // рот с зубами
  px(6, 9, 4, 2, '#1a2410');
  px(7, 9, 1, 1, '#e8e0cf');
  px(9, 9, 1, 1, '#e8e0cf');
}

// «Пиксельная картинка» на экране победы: лесная полянка и побеждённый босс.
function drawVictoryPicture(id, x, y, w, h) {
  const sky = ctx.createLinearGradient(0, y, 0, y + h * 0.7);
  sky.addColorStop(0, '#8fd6ff');
  sky.addColorStop(1, '#d9f2c8');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = '#ffe58a';
  ctx.beginPath();
  ctx.arc(x + w - 44, y + 38, 18, 0, Math.PI * 2);
  ctx.fill();

  // дальние ёлки
  ctx.fillStyle = '#2f6b3f';
  for (let i = 0; i < 5; i++) {
    const fx = x + 28 + i * 62;
    const fh = 38 + ((i * 13) % 18);
    ctx.beginPath();
    ctx.moveTo(fx - 19, y + h - 56);
    ctx.lineTo(fx, y + h - 56 - fh);
    ctx.lineTo(fx + 19, y + h - 56);
    ctx.closePath();
    ctx.fill();
  }

  // земля
  ctx.fillStyle = '#4a8a4f';
  ctx.fillRect(x, y + h - 56, w, 56);
  ctx.fillStyle = '#3f7a45';
  ctx.fillRect(x, y + h - 40, w, 40);

  // кустики и грибы
  ctx.fillStyle = '#356b3c';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.ellipse(x + 22 + i * 52, y + h - 42, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const mx of [x + 46, x + w - 58]) {
    ctx.fillStyle = '#c8452f';
    ctx.fillRect(mx, y + h - 52, 7, 4);
    ctx.fillStyle = '#e8e0cf';
    ctx.fillRect(mx + 1, y + h - 51, 2, 2);
  }

  // побеждённый босс
  if (id === 'yaga') drawYagaPortrait(x + w / 2, y + h - 24, 7);
  else drawLeshyPortrait(x + w / 2, y + h - 24, 7);
}

function drawVictory() {
  drawPlay();
  ctx.fillStyle = 'rgba(6, 14, 10, 0.9)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const v = victory;
  if (!v) return;
  const yaga = v.id === 'yaga';

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdf7a';
  ctx.font = 'bold 38px "Courier New", monospace';
  ctx.fillText('ПОБЕДА!', VIEW_W / 2, 56);
  ctx.fillStyle = '#cfe3d2';
  ctx.font = '15px "Courier New", monospace';
  ctx.fillText(
    yaga ? 'Баба-яга побеждена!' : 'Леший побеждён — путь из леса открыт!',
    VIEW_W / 2,
    82
  );

  // рамка с картинкой
  const pw = 300;
  const ph = 200;
  const px0 = (VIEW_W - pw) / 2;
  const py0 = 96;
  ctx.fillStyle = '#14211a';
  ctx.fillRect(px0 - 8, py0 - 8, pw + 16, ph + 16);
  drawVictoryPicture(v.id, px0, py0, pw, ph);
  ctx.strokeStyle = '#f4e9c8';
  ctx.lineWidth = 4;
  ctx.strokeRect(px0 - 8, py0 - 8, pw + 16, ph + 16);

  // звёзды появляются по одной
  for (let i = 0; i < 3; i++) {
    const start = 0.25 + i * 0.3;
    const k = Math.max(0, Math.min(1, (v.t - start) / 0.3));
    if (k <= 0) continue;
    const pop = 1 + Math.sin(k * Math.PI) * 0.4;
    drawStar(VIEW_W / 2 + (i - 1) * 82, 342, 26 * k * pop, i < v.stars);
  }

  // алмазики
  drawItemIcon(ctx, 'diamond', VIEW_W / 2 - 122, 372, 26);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#bff0ff';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('+' + v.gain + ' алмазиков', VIEW_W / 2 - 90, 393);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#8fae96';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText('всего: ' + progress.diamonds, VIEW_W / 2 + 180, 393);

  const ranks = ['Победа на последнем дыхании!', 'Хороший бой!', 'Безупречно — ни одной лишней царапины!'];
  ctx.textAlign = 'center';
  ctx.fillStyle = v.stars === 3 ? '#ffdf7a' : '#cfe3d2';
  ctx.font = '14px "Courier New", monospace';
  ctx.fillText(ranks[v.stars - 1], VIEW_W / 2, 418);

  // кнопка
  ctx.fillStyle = hit(VICT_BTN, mouse.x, mouse.y) ? '#7bbd63' : '#5d9a4c';
  ctx.fillRect(VICT_BTN.x, VICT_BTN.y, VICT_BTN.w, VICT_BTN.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f4e9c8';
  ctx.strokeRect(VICT_BTN.x + 1.5, VICT_BTN.y + 1.5, VICT_BTN.w - 3, VICT_BTN.h - 3);
  ctx.fillStyle = '#12240f';
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillText('ДАЛЬШЕ', VICT_BTN.x + VICT_BTN.w / 2, VICT_BTN.y + 32);

  ctx.fillStyle = '#7f9c86';
  ctx.font = (IS_TOUCH ? 15 : 13) + 'px "Courier New", monospace';
  ctx.fillText(
    uiMode === 'touch'
      ? 'Алмазики тратятся в лавке одежды. Нажми «ДАЛЬШЕ»'
      : uiMode === 'gamepad'
        ? 'A — дальше · алмазики тратятся в лавке одежды'
        : 'Enter — дальше · алмазики тратятся в лавке одежды',
    VIEW_W / 2,
    508
  );
}

function updateVictory(dt) {
  if (victory) victory.t += dt;
  if (!mouse.clicked) return;
  mouse.clicked = false;
  if (hit(VICT_BTN, mouse.x, mouse.y)) closeVictory();
}

function closeVictory() {
  victory = null;
  state = 'play';
  player.invuln = 1.5;
  mouse.clicked = false;
}

/* --------------------------- Меню паузы ---------------------------------- */

const MENU_PANEL = { x: VIEW_W / 2 - 230, y: 84, w: 460, h: 468 };
const MENU_ITEM = { x: VIEW_W / 2 - 180, y: 158, w: 360, h: 58, gap: 8 };

function menuItemRect(i) {
  return {
    x: MENU_ITEM.x,
    y: MENU_ITEM.y + i * (MENU_ITEM.h + MENU_ITEM.gap),
    w: MENU_ITEM.w,
    h: MENU_ITEM.h,
  };
}

function fullscreenSupported() {
  try {
    const el = document.documentElement;
    return !!(el && (el.requestFullscreen || el.webkitRequestFullscreen));
  } catch (e) {
    return false;
  }
}

function isFullscreen() {
  try {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  } catch (e) {
    return false;
  }
}

function toggleFullscreen() {
  try {
    const el = document.documentElement;
    if (isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document);
      return;
    }
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) {
      showToast('Полный экран не поддерживается браузером', '#ffd08a');
      return;
    }
    const result = request.call(el);
    if (result && result.catch) {
      result.catch(() => showToast('Не удалось включить полный экран', '#ffd08a'));
    }
  } catch (e) {
    showToast('Не удалось включить полный экран', '#ffd08a');
  }
}

function menuItems() {
  const items = [
    { id: 'resume', label: 'ПРОДОЛЖИТЬ' },
    { id: 'help', label: 'КАК ИГРАТЬ' },
  ];
  if (fullscreenSupported()) {
    items.push({ id: 'fullscreen', label: isFullscreen() ? 'ОБЫЧНЫЙ ЭКРАН' : 'ВО ВЕСЬ ЭКРАН' });
  }
  items.push({ id: 'restart', label: 'НАЧАТЬ ЗАНОВО' });
  items.push({ id: 'select', label: 'СМЕНИТЬ ГЕРОЯ' });
  return items;
}

function menuActivate(id) {
  if (id === 'resume') closeMenu();
  else if (id === 'help') openHelp();
  else if (id === 'fullscreen') toggleFullscreen();
  else if (id === 'restart') {
    closeMenu();
    startGame();
  } else if (id === 'select') {
    closeMenu();
    craftOpen = false;
    shopOpen = false;
    dialog = null;
    sleep.active = false;
    state = 'select';
    mouse.clicked = false;
  }
}

function updateMenu() {
  if (!mouse.clicked) return;
  mouse.clicked = false;
  const items = menuItems();
  for (let i = 0; i < items.length; i++) {
    if (hit(menuItemRect(i), mouse.x, mouse.y)) {
      menuSel = i;
      menuActivate(items[i].id);
      return;
    }
  }
  const p = MENU_PANEL;
  if (mouse.x < p.x || mouse.x > p.x + p.w || mouse.y < p.y || mouse.y > p.y + p.h) {
    closeMenu();
  }
}

function drawMenu() {
  ctx.fillStyle = 'rgba(6, 14, 10, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const p = MENU_PANEL;
  ctx.fillStyle = '#1c2c21';
  ctx.fillRect(p.x, p.y, p.w, p.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#f4e9c8';
  ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 3, p.h - 3);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdf7a';
  ctx.font = 'bold 30px "Courier New", monospace';
  ctx.fillText('ПАУЗА', VIEW_W / 2, p.y + 44);
  ctx.fillStyle = '#9dbfa4';
  ctx.font = (IS_TOUCH ? 16 : 14) + 'px "Courier New", monospace';
  ctx.fillText('Игра остановлена — лес подождёт', VIEW_W / 2, p.y + 68);

  const items = menuItems();
  menuSel = clamp(menuSel, 0, items.length - 1);
  for (let i = 0; i < items.length; i++) {
    const r = menuItemRect(i);
    const hovered = hit(r, mouse.x, mouse.y);
    const focused = i === menuSel && uiMode !== 'touch';
    ctx.fillStyle = focused || hovered ? '#3b5f43' : '#2c4733';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.lineWidth = focused ? 3 : 2;
    ctx.strokeStyle = focused ? '#ffd45c' : hovered ? '#f4e9c8' : '#4a6b52';
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.fillStyle = '#f4e9c8';
    ctx.font = 'bold 19px "Courier New", monospace';
    ctx.fillText(items[i].label, r.x + r.w / 2, r.y + 37);
  }

  ctx.fillStyle = '#7f9c86';
  ctx.font = (IS_TOUCH ? 15 : 13) + 'px "Courier New", monospace';
  const hint =
    uiMode === 'touch'
      ? 'Нажми пункт меню · кнопки вернутся в игру'
      : uiMode === 'gamepad'
        ? 'Стик — выбор · A — открыть · Start / B — продолжить'
        : 'Стрелки — выбор · Enter — открыть · Esc — продолжить';
  ctx.fillText(hint, VIEW_W / 2, p.y + p.h - 18);
  ctx.textAlign = 'left';
}

/* ------------------------------- Цикл ------------------------------------ */

function drawCurrentScreen() {
  if (state === 'intro') drawIntro();
  else if (state === 'select') drawSelect();
  else if (state === 'faint') drawFaint();
  else if (state === 'win') drawWin();
  else if (state === 'victory') drawVictory();
  else drawPlay();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  updateToast(dt);

  // На телефоне в вертикальном положении показываем подсказку «поверни» и
  // останавливаем игру, чтобы герой не погиб, пока игрок читает.
  if (isPortraitTouch()) {
    drawCurrentScreen();
    drawToast();
    requestAnimationFrame(loop);
    return;
  }

  pollGamepad(dt);
  updateTouchUi(dt);

  if (helpOpen) {
    updateHelp();
    drawHelpScreen();
  } else if (menuOpen) {
    updateMenu();
    drawPlay();
    drawMenu();
  } else if (state === 'intro') {
    updateIntro(dt);
    drawIntro();
  } else if (state === 'select') {
    updateSelect(dt);
    drawSelect();
  } else if (state === 'faint') {
    updateFaint();
    drawFaint();
  } else if (state === 'win') {
    updateWin();
    drawWin();
  } else if (state === 'victory') {
    updateVictory(dt);
    drawVictory();
  } else {
    updatePlay(dt);
    drawPlay();
  }
  drawToast();
  requestAnimationFrame(loop);
}

loadProgress();
buildCity();
buildWorld();
requestAnimationFrame(loop);
