#!/usr/bin/env node
// Генерирует неконтрастную тему карты из style.json (MapTiler/Mapbox):
// светлую (по умолчанию) или тёмную (режим dark).
//
// Принцип: каждый цвет из исходного стиля десатурируется и приводится к
// единой мягкой гамме, сохраняя оттенок (hue). Итог — спокойная, читаемая
// карта без ярких «попов», в которой видна сетка улиц, кварталы, вода и
// зелень. Светлая и тёмная темы строятся по одному и тому же «рецепту».
//
// Использование:
//   node tools/generate-map-light-theme.mjs <url-style.json> <выходной.json> [dark]
//
// Примеры:
//   node tools/generate-map-light-theme.mjs \
//     "https://api.maptiler.com/maps/<style-id>/style.json?key=<key>" \
//     app/frontend/public/styles/map-light.json
//
//   node tools/generate-map-light-theme.mjs \
//     "https://api.maptiler.com/maps/<dark-style-id>/style.json?key=<key>" \
//     app/frontend/public/styles/map-dark.json dark

const inputUrl = process.argv[2];
const outputPath = process.argv[3];
const mode = process.argv[4] === "dark" ? "dark" : "light";

if (!inputUrl || !outputPath) {
  console.error("Использование: node tools/generate-map-light-theme.mjs <url|файл> <выходной.json> [dark]");
  process.exit(1);
}

function parseHsl(value) {
  const m = /^hsla\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,\s*([\d.]+)\s*\)$/i.exec(value);
  if (m) return { h: Number(m[1]), s: Number(m[2]) / 100, l: Number(m[3]) / 100, a: Number(m[4]) };
  const m2 = /^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(value);
  if (m2) return { h: Number(m2[1]), s: Number(m2[2]) / 100, l: Number(m2[3]) / 100, a: 1 };
  return null;
}

function parseHex(value) {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const a = m[2] ? parseInt(m[2], 16) / 255 : 1;
  return { h: 0, s: 0, l: 0, a, rgb: { r, g, b } };
}

function rgbToHsl({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h / 6) * 360;
  }
  return { h, s, l, a: 1 };
}

function hslToString({ h, s, l, a }) {
  const p = (v) => `${Math.round(v * 100)}%`;
  return a < 1
    ? `hsla(${Math.round(h)}, ${p(s)}, ${p(l)}, ${a})`
    : `hsl(${Math.round(h)}, ${p(s)}, ${p(l)})`;
}

function parseColorString(value) {
  const hsl = parseHsl(value);
  if (hsl) return hsl;
  const hex = parseHex(value);
  if (hex) {
    const { h, s, l } = rgbToHsl(hex.rgb);
    return { h, s, l, a: hex.a };
  }
  return null;
}

// Светлый режим: текст превращается в мягкий серый (~42–46%),
// заливки — в максимально светлые пастельные (~90%).
function softenLight({ h, s, l, a }) {
  const s2 = Math.min(0.3, s * 0.18);
  let l2;
  if (l <= 0.28) l2 = 0.42;
  else if (l <= 0.55) l2 = 0.46;
  else if (l <= 0.85) l2 = 0.9;
  else l2 = 0.93;
  return { h, s: s2, l: l2, a };
}

// Тёмный режим: текст остаётся светлым и читаемым (~85%),
// заливки приглушаются и уходят в тёмные мягкие тона.
function softenDark({ h, s, l, a }) {
  const s2 = Math.min(0.3, s * 0.3);
  let l2;
  if (l <= 0.2) l2 = 0.1 + l * 0.35;
  else if (l <= 0.45) l2 = 0.2 + (l - 0.2) * 0.3;
  else if (l <= 0.7) l2 = 0.45 + (l - 0.45) * 0.6;
  else l2 = 0.72 + (l - 0.7) * 0.45;
  return { h, s: s2, l: l2, a };
}

const PALETTES = {
  light: {
    background: "#f8f7f3",
    water: "#d2e1ec",
    river: "#c2d6e4",
    green: "#e0e9d7",
    building: "#d6d2cb",
    building3d: "#dbd7d0",
    roadCasing: "#cec7bd",
    roadFill: "#ffffff",
    tone: softenLight,
  },
  dark: {
    background: "#283340",
    water: "#263745",
    river: "#31485a",
    green: "#28392e",
    building: "#3b3935",
    building3d: "#413f3b",
    roadCasing: "#45423d",
    roadFill: "#3c3a36",
    tone: softenDark,
  },
};

const P = PALETTES[mode];

function transformNode(node) {
  if (typeof node === "string") {
    const parsed = parseColorString(node);
    return parsed ? hslToString(P.tone(parsed)) : node;
  }
  if (Array.isArray(node)) {
    if (
      (node[0] === "rgb" || node[0] === "rgba") &&
      node.slice(1).every((v) => typeof v === "number")
    ) {
      const [op, r, g, b, a] = node;
      const { h, s, l } = rgbToHsl({ r: r / 255, g: g / 255, b: b / 255 });
      const toned = P.tone({ h, s, l, a: a ?? 1 });
      return op === "rgba"
        ? ["hsla", toned.h, toned.s, toned.l, toned.a]
        : ["hsl", toned.h, toned.s, toned.l];
    }
    return node.map(transformNode);
  }
  if (node && typeof node === "object") {
    const out = {};
    for (const key of Object.keys(node)) out[key] = transformNode(node[key]);
    return out;
  }
  return node;
}

function replaceCredentials(node) {
  if (typeof node === "string") {
    return node.replace(/([?&](?:key|access_token)=)[^&"]*/gi, "$1__MAPTILER_KEY__");
  }
  if (Array.isArray(node)) return node.map(replaceCredentials);
  if (node && typeof node === "object") {
    const out = {};
    for (const key of Object.keys(node)) out[key] = replaceCredentials(node[key]);
    return out;
  }
  return node;
}

// Явные коррекции для ключевых слоёв — гарантируют базовые тона.
function applyOverrides(style) {
  for (const layer of style.layers ?? []) {
    if (layer.id === "Background" && layer.paint) {
      layer.paint["background-color"] = P.background;
    } else if (/^Water($| )/.test(layer.id) && layer.paint) {
      layer.paint["fill-color"] = P.water;
    } else if (/^River|^Stream/.test(layer.id) && layer.paint) {
      layer.paint["line-color"] = P.river;
    } else if (/^(Farmland|Vegetation|Wood|Forest|Grass|Park|Zoo|Leisure|Pitch)$/.test(layer.id) && layer.paint) {
      layer.paint["fill-color"] = P.green;
    } else if (layer.id === "Building" && layer.paint) {
      layer.paint["fill-color"] = P.building;
    } else if (layer.id === "Building 3D" && layer.paint) {
      layer.paint["fill-extrusion-color"] = P.building3d;
    }
  }
}

const ROAD_ID =
  /Highway|Major road|Minor road|Service road|Cycleway|Pathway|Track|Steps|No access|Pedestrian|Pier road|Road (bridge|tunnel)|Ramp|\bPath\b|Footway|^Bridge( |$)|^Tunnel( |$)/i;

// Возвращает дорогам контраст: светлая заливка + видимая обводка.
function applyRoadContrast(style) {
  for (const layer of style.layers ?? []) {
    if (!layer.paint || layer.type === "symbol") continue;
    if (!ROAD_ID.test(layer.id)) continue;
    const isOutline = /outline|hatching/i.test(layer.id);
    if (isOutline) {
      layer.paint["line-color"] = P.roadCasing;
    } else if (layer.type === "line") {
      layer.paint["line-color"] = P.roadFill;
    } else if (layer.type === "fill") {
      layer.paint["fill-color"] = P.roadFill;
    }
  }
}

async function main() {
  let style;
  if (/^https?:/i.test(inputUrl)) {
    const response = await fetch(inputUrl);
    if (!response.ok) throw new Error(`Невозможно загрузить стиль: ${response.status} ${response.statusText}`);
    style = await response.json();
  } else {
    const { readFile } = await import("node:fs/promises");
    style = JSON.parse(await readFile(inputUrl, "utf8"));
  }

  const originName = style.name ?? "unknown";
  const toned = transformNode(replaceCredentials(style));
  applyOverrides(toned);
  applyRoadContrast(toned);
  toned.name = `${originName} (${mode})`;

  const { writeFile } = await import("node:fs/promises");
  await writeFile(outputPath, JSON.stringify(toned, null, 2) + "\n");

  console.log(`Готово (${mode}): ${outputPath}`);
  console.log(`Слоёв: ${toned.layers.length}, фон: ${JSON.stringify(toned.layers.find((l) => l.id === "Background")?.paint?.["background-color"])}`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});