"use strict";

const STORAGE_KEY = "pixel-ramp-lab.v1";

const DATA = {
  courseRules: [
    { name: "Limited palette", detail: "Start with a small ramp before adding extra colors." },
    { name: "Value first", detail: "Readable silhouettes come from luminance separation, not hue novelty." },
    { name: "Hue-shift ramps", detail: "Let shadows cool and highlights warm instead of only changing lightness." },
    { name: "Controlled saturation", detail: "Push saturation where the player should look first." },
    { name: "Dither sparingly", detail: "Use patterns to imply texture, not to hide an unclear palette." }
  ],
  presets: [
    { id: "sunlit-brass", name: "Sunlit brass", hue: 43, saturation: 72, environment: "sun", note: "Warm highlights and olive shadows for readable treasure sprites." },
    { id: "moonlit-ivy", name: "Moonlit ivy", hue: 142, saturation: 46, environment: "moon", note: "Cool blue-green values for foliage, slime, and quiet night tiles." },
    { id: "cave-ruby", name: "Cave ruby", hue: 352, saturation: 82, environment: "cave", note: "Deep red ramp with muted shadow mass and sharp highlight accents." },
    { id: "harbor-steel", name: "Harbor steel", hue: 207, saturation: 36, environment: "overcast", note: "Low-saturation blue ramp for metal, wet stone, and cloudy UI frames." },
    { id: "neon-plum", name: "Neon plum", hue: 289, saturation: 68, environment: "neon", note: "High-chroma accent ramp for magical effects and readable pickups." },
    { id: "ember-clay", name: "Ember clay", hue: 18, saturation: 60, environment: "sun", note: "Earthy orange ramp for pottery, brick, and warm terrain." }
  ]
};

const ENVIRONMENTS = {
  sun: { hue: [-30, -8, 8, 24], sat: [-22, -6, 5, -8], light: [13, 31, 58, 83] },
  moon: { hue: [24, 10, -4, -18], sat: [-34, -18, -8, -16], light: [10, 28, 52, 78] },
  cave: { hue: [-16, -6, 7, 18], sat: [-20, 0, 8, -10], light: [7, 22, 46, 72] },
  overcast: { hue: [10, 4, -2, -8], sat: [-38, -24, -14, -22], light: [17, 36, 59, 80] },
  neon: { hue: [-42, -12, 10, 38], sat: [8, 18, 22, 4], light: [8, 32, 61, 86] }
};

const SPRITE_MASKS = {
  gem: [
    "0001111000000000",
    "0012222210000000",
    "0122333321000000",
    "1223333332100000",
    "1233333332100000",
    "1233333332100000",
    "0123333321000000",
    "0012333210000000",
    "0001222100000000",
    "0000111000000000"
  ],
  character: [
    "0000111100000000",
    "0001222210000000",
    "0001233210000000",
    "0001222210000000",
    "0000122100000000",
    "0001233210000000",
    "0012333321000000",
    "0012323321000000",
    "0001222210000000",
    "0001122110000000",
    "0001000010000000"
  ],
  tile: [
    "1111111111111111",
    "1222222222222221",
    "1233332333332321",
    "1232222222222321",
    "1232233333222321",
    "1222222222222221",
    "1233333333332321",
    "1222222322222221",
    "1233222322332321",
    "1222222222222221",
    "1111111111111111"
  ],
  ui: [
    "1111111111110000",
    "1222222222210000",
    "1233333333210000",
    "1232222223210000",
    "1232222223210000",
    "1233333333210000",
    "1222222222210000",
    "1111111111110000"
  ]
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const DEFAULT_ART_SIZE = 16;
const ART_SIZES = [8, 16, 24, 32];
const ART_ZOOMS = [1, 2, 4];
const ART_CANVAS_PIXELS = 512;

const state = {
  selectedId: "sunlit-brass",
  source: "preset",
  name: "Sunlit brass",
  hue: 43,
  saturation: 72,
  environment: "sun",
  dither: "none",
  size: 4,
  sprite: "gem",
  filter: "all",
  importedRamp: null,
  saved: [],
  liked: [],
  tool: "paint",
  brushIndex: 0,
  artName: "Untitled sprite",
  artSize: DEFAULT_ART_SIZE,
  artZoom: 1,
  artOffsetX: 0,
  artOffsetY: 0,
  panStart: null,
  artPixels: createBlankArt(DEFAULT_ART_SIZE),
  artPieces: [],
  isDrawing: false
};

function createBlankArt(size) {
  return Array(size * size).fill(null);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapHue(value) {
  return ((value % 360) + 360) % 360;
}

function interpolate(points, t) {
  const scaled = t * (points.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(points.length - 1, index + 1);
  const local = scaled - index;
  return points[index] + (points[next] - points[index]) * local;
}

function hslToRgb(h, s, l) {
  const hue = h / 360;
  const sat = s / 100;
  const light = l / 100;
  const hue2rgb = (p, q, t) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };
  if (sat === 0) {
    const gray = Math.round(light * 255);
    return [gray, gray, gray];
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  return [
    Math.round(hue2rgb(p, q, hue + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hue) * 255),
    Math.round(hue2rgb(p, q, hue - 1 / 3) * 255)
  ];
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

function relativeLuminance(rgb) {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a, b) {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

function buildRamp() {
  if (state.importedRamp?.length) {
    return state.importedRamp.slice(0, state.size).map((hex) => ({
      hex,
      rgb: hexToRgb(hex),
      light: Math.round(relativeLuminance(hexToRgb(hex)) * 100)
    }));
  }

  const env = ENVIRONMENTS[state.environment] || ENVIRONMENTS.sun;
  const steps = state.size;
  return Array.from({ length: steps }, (_, index) => {
    const t = steps === 1 ? 0 : index / (steps - 1);
    const hueShift = interpolate(env.hue, t);
    const satShift = interpolate(env.sat, t);
    const light = interpolate(env.light, t);
    const hue = wrapHue(state.hue + hueShift);
    const saturation = clamp(state.saturation + satShift, 8, 98);
    const rgb = hslToRgb(hue, saturation, light);
    return { hex: rgbToHex(rgb), rgb, light: Math.round(light) };
  });
}

function paletteIdFromState() {
  if (state.selectedId) return state.selectedId;
  return `${state.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${state.hue}-${state.saturation}-${state.environment}-${state.size}`;
}

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.saved = Array.isArray(parsed.saved) ? parsed.saved : [];
    state.liked = Array.isArray(parsed.liked) ? parsed.liked : [];
    state.artPieces = Array.isArray(parsed.artPieces) ? parsed.artPieces : [];
  } catch {
    state.saved = [];
    state.liked = [];
    state.artPieces = [];
  }
}

function writeStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    saved: state.saved,
    liked: state.liked,
    artPieces: state.artPieces
  }));
}

function encodeShareState() {
  const params = new URLSearchParams({
    name: state.name,
    hue: String(state.hue),
    sat: String(state.saturation),
    env: state.environment,
    dith: state.dither,
    size: String(state.size),
    sprite: state.sprite
  });
  if (state.importedRamp?.length) params.set("ramp", state.importedRamp.join(","));
  return params.toString();
}

function applyShareState() {
  const params = new URLSearchParams(window.location.search);
  if (!params.size) return;
  state.name = params.get("name") || state.name;
  state.hue = clamp(Number(params.get("hue")) || state.hue, 0, 359);
  state.saturation = clamp(Number(params.get("sat")) || state.saturation, 12, 96);
  state.environment = params.get("env") || state.environment;
  state.dither = params.get("dith") || state.dither;
  state.size = [4, 8, 16].includes(Number(params.get("size"))) ? Number(params.get("size")) : state.size;
  state.sprite = params.get("sprite") || state.sprite;
  const ramp = parseHexList(params.get("ramp") || "");
  if (ramp.length) {
    state.importedRamp = ramp;
    state.source = "import";
    state.selectedId = "";
  }
}

function syncUrl() {
  const url = `${window.location.pathname}?${encodeShareState()}`;
  window.history.replaceState(null, "", url);
}

function parseHexList(input) {
  return (input.match(/#[0-9a-f]{6}\b|(?<![0-9a-f])[0-9a-f]{6}\b/gi) || [])
    .map((item) => (item.startsWith("#") ? item : `#${item}`).toLowerCase())
    .filter((hex, index, list) => list.indexOf(hex) === index);
}

function setPreset(id) {
  const preset = DATA.presets.find((item) => item.id === id);
  if (!preset) return;
  Object.assign(state, {
    selectedId: preset.id,
    source: "preset",
    name: preset.name,
    hue: preset.hue,
    saturation: preset.saturation,
    environment: preset.environment,
    importedRamp: null
  });
  $("#import-input").value = "";
  render();
}

function setFromSaved(saved) {
  Object.assign(state, {
    selectedId: saved.id,
    source: "saved",
    name: saved.name,
    hue: saved.hue,
    saturation: saved.saturation,
    environment: saved.environment,
    dither: saved.dither,
    size: saved.size,
    sprite: saved.sprite,
    importedRamp: saved.importedRamp || null
  });
  render();
}

function toggleLike() {
  const id = paletteIdFromState();
  if (state.liked.includes(id)) {
    state.liked = state.liked.filter((item) => item !== id);
  } else {
    state.liked = [...state.liked, id];
  }
  writeStore();
  render();
}

function savePalette() {
  const ramp = buildRamp().map((color) => color.hex);
  const id = `saved-${Date.now()}`;
  const saved = {
    id,
    source: "saved",
    name: state.name.trim() || "Untitled ramp",
    hue: state.hue,
    saturation: state.saturation,
    environment: state.environment,
    dither: state.dither,
    size: state.size,
    sprite: state.sprite,
    importedRamp: state.importedRamp,
    ramp,
    createdAt: new Date().toISOString()
  };
  state.saved = [saved, ...state.saved.filter((item) => item.name !== saved.name)].slice(0, 80);
  state.selectedId = id;
  state.source = "saved";
  writeStore();
  render();
}

function deleteSaved(id) {
  state.saved = state.saved.filter((item) => item.id !== id);
  state.liked = state.liked.filter((item) => item !== id);
  writeStore();
  render();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    $("#copy-status").textContent = "Copied";
  } catch {
    $("#copy-status").textContent = "Select and copy manually";
  }
  window.setTimeout(() => {
    $("#copy-status").textContent = "";
  }, 1800);
}

function exportText(format) {
  const ramp = buildRamp();
  const hexes = ramp.map((color) => color.hex);
  if (format === "css") {
    return hexes.map((hex, index) => `--ramp-${String(index + 1).padStart(2, "0")}: ${hex};`).join("\n");
  }
  if (format === "gpl") {
    return [
      "GIMP Palette",
      `Name: ${state.name}`,
      "Columns: 8",
      "#",
      ...ramp.map((color, index) => `${color.rgb.join(" ")}\t${state.name.replace(/\s+/g, "-")}-${index + 1}`)
    ].join("\n");
  }
  if (format === "json") {
    return JSON.stringify({
      name: state.name,
      hue: state.hue,
      saturation: state.saturation,
      environment: state.environment,
      dither: state.dither,
      size: state.size,
      colors: hexes
    }, null, 2);
  }
  return hexes.join(" ");
}

function shouldDither(x, y, pattern) {
  if (pattern === "checker") return (x + y) % 2 === 0;
  if (pattern === "diagonal") return (x - y) % 4 === 0;
  if (pattern === "vertical") return x % 3 === 0;
  if (pattern === "noise") return ((x * 17 + y * 31) % 7) < 2;
  return false;
}

function drawSprite(ramp) {
  const canvas = $("#sprite-canvas");
  const context = canvas.getContext("2d");
  const scale = 16;
  const mask = SPRITE_MASKS[state.sprite] || SPRITE_MASKS.gem;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f7f4ec";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const offsetX = Math.floor((16 - mask[0].length) / 2);
  const offsetY = Math.floor((16 - mask.length) / 2);
  mask.forEach((row, y) => {
    row.split("").forEach((value, x) => {
      const raw = Number(value);
      if (!raw) return;
      const colorIndex = Math.min(ramp.length - 1, Math.round((raw - 1) / 2 * (ramp.length - 1)));
      const altIndex = Math.max(0, colorIndex - 1);
      const color = shouldDither(x, y, state.dither) ? ramp[altIndex] : ramp[colorIndex];
      context.fillStyle = color.hex;
      context.fillRect((x + offsetX) * scale, (y + offsetY) * scale, scale, scale);
    });
  });

  context.strokeStyle = "rgba(28, 32, 29, 0.18)";
  context.lineWidth = 1;
  for (let i = 0; i <= 16; i += 1) {
    context.beginPath();
    context.moveTo(i * scale, 0);
    context.lineTo(i * scale, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, i * scale);
    context.lineTo(canvas.width, i * scale);
    context.stroke();
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function currentBrushHex(ramp) {
  const index = clamp(state.brushIndex, 0, ramp.length - 1);
  return ramp[index]?.hex || "#000000";
}

function visibleArtCells() {
  return Math.max(1, Math.floor(state.artSize / state.artZoom));
}

function clampArtViewport() {
  const visible = visibleArtCells();
  state.artOffsetX = clamp(Math.round(state.artOffsetX), 0, Math.max(0, state.artSize - visible));
  state.artOffsetY = clamp(Math.round(state.artOffsetY), 0, Math.max(0, state.artSize - visible));
}

function setArtZoom(nextZoom) {
  if (!ART_ZOOMS.includes(nextZoom) || nextZoom === state.artZoom) return;
  const previousVisible = visibleArtCells();
  const centerX = state.artOffsetX + previousVisible / 2;
  const centerY = state.artOffsetY + previousVisible / 2;
  state.artZoom = nextZoom;
  const nextVisible = visibleArtCells();
  state.artOffsetX = Math.floor(centerX - nextVisible / 2);
  state.artOffsetY = Math.floor(centerY - nextVisible / 2);
  clampArtViewport();
  drawPixelArt(buildRamp());
}

function panArtViewport(deltaX, deltaY) {
  state.artOffsetX += deltaX;
  state.artOffsetY += deltaY;
  clampArtViewport();
  drawPixelArt(buildRamp());
}

function artCellFromEvent(event) {
  const canvas = $("#art-canvas");
  const rect = canvas.getBoundingClientRect();
  const visible = visibleArtCells();
  const x = state.artOffsetX + Math.floor(((event.clientX - rect.left) / rect.width) * visible);
  const y = state.artOffsetY + Math.floor(((event.clientY - rect.top) / rect.height) * visible);
  if (x < 0 || x >= state.artSize || y < 0 || y >= state.artSize) return null;
  return y * state.artSize + x;
}

function paintArtCell(event) {
  const cell = artCellFromEvent(event);
  if (cell === null) return;
  const ramp = buildRamp();
  state.artPixels[cell] = state.tool === "erase" ? null : currentBrushHex(ramp);
  drawPixelArt(ramp);
}

function syncArtCanvasSize() {
  const canvas = $("#art-canvas");
  if (canvas.width !== ART_CANVAS_PIXELS) canvas.width = ART_CANVAS_PIXELS;
  if (canvas.height !== ART_CANVAS_PIXELS) canvas.height = ART_CANVAS_PIXELS;
}

function drawPixelArt(ramp) {
  const canvas = $("#art-canvas");
  syncArtCanvasSize();
  canvas.style.cursor = state.tool === "pan" ? "grab" : "crosshair";
  const context = canvas.getContext("2d");
  clampArtViewport();
  const visible = visibleArtCells();
  const cell = canvas.width / visible;
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < visible; y += 1) {
    for (let x = 0; x < visible; x += 1) {
      const sourceX = state.artOffsetX + x;
      const sourceY = state.artOffsetY + y;
      context.fillStyle = (sourceX + sourceY) % 2 === 0 ? "#f7f4ec" : "#ece7d8";
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  for (let y = 0; y < visible; y += 1) {
    for (let x = 0; x < visible; x += 1) {
      const sourceX = state.artOffsetX + x;
      const sourceY = state.artOffsetY + y;
      const hex = state.artPixels[sourceY * state.artSize + sourceX];
      if (!hex) continue;
      context.fillStyle = hex;
      context.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  context.strokeStyle = "rgba(28, 32, 29, 0.22)";
  context.lineWidth = 1;
  for (let line = 0; line <= visible; line += 1) {
    context.beginPath();
    context.moveTo(line * cell, 0);
    context.lineTo(line * cell, canvas.height);
    context.stroke();
    context.beginPath();
    context.moveTo(0, line * cell);
    context.lineTo(canvas.width, line * cell);
    context.stroke();
  }

  const activeColor = state.tool === "erase" ? "eraser" : currentBrushHex(ramp);
  const viewport = state.artZoom === 1 ? "full" : `${state.artOffsetX + 1},${state.artOffsetY + 1}`;
  $("#art-status").textContent = `${state.artSize} x ${state.artSize}, ${state.artZoom}x, ${viewport}, ${state.tool}, ${activeColor}`;
}

function resizePixelArt(nextSize) {
  if (!ART_SIZES.includes(nextSize) || nextSize === state.artSize) return;
  const previousSize = state.artSize;
  const nextPixels = createBlankArt(nextSize);
  const copySize = Math.min(previousSize, nextSize);
  for (let y = 0; y < copySize; y += 1) {
    for (let x = 0; x < copySize; x += 1) {
      nextPixels[y * nextSize + x] = state.artPixels[y * previousSize + x];
    }
  }
  state.artSize = nextSize;
  state.artPixels = nextPixels;
  clampArtViewport();
  drawPixelArt(buildRamp());
}

function renderBrushes(ramp) {
  state.brushIndex = clamp(state.brushIndex, 0, ramp.length - 1);
  const strip = $("#brush-strip");
  strip.style.setProperty("--swatch-count", String(ramp.length));
  strip.innerHTML = ramp.map((color, index) => (
    `<button class="brush-button ${index === state.brushIndex ? "is-active" : ""}" type="button" data-brush="${index}" style="background:${color.hex}" aria-label="Brush ${color.hex}"></button>`
  )).join("");
  $$("[data-brush]").forEach((button) => {
    button.addEventListener("click", () => {
      state.brushIndex = Number(button.dataset.brush);
      state.tool = "paint";
      renderBrushes(buildRamp());
      drawPixelArt(buildRamp());
      renderToolButtons();
    });
  });
}

function renderToolButtons() {
  $$("[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === state.tool);
  });
}

function drawArtThumbnail(piece) {
  const size = piece.size || Math.sqrt(piece.pixels.length) || DEFAULT_ART_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.fillStyle = "#f7f4ec";
  context.fillRect(0, 0, size, size);
  piece.pixels.forEach((hex, index) => {
    if (!hex) return;
    context.fillStyle = hex;
    context.fillRect(index % size, Math.floor(index / size), 1, 1);
  });
  return canvas.toDataURL("image/png");
}

function renderArtGallery() {
  const gallery = $("#art-gallery");
  if (!state.artPieces.length) {
    gallery.innerHTML = `<div class="empty-state">No saved pixel art yet.</div>`;
    return;
  }
  gallery.innerHTML = state.artPieces.slice(0, 12).map((piece) => `
    <article class="art-card">
      <img class="art-thumb" src="${drawArtThumbnail(piece)}" alt="">
      <button type="button" data-load-art="${piece.id}">
        <strong>${escapeHtml(piece.name)}</strong>
        <span>${piece.size || DEFAULT_ART_SIZE} x ${piece.size || DEFAULT_ART_SIZE}, ${piece.pixels.filter(Boolean).length} painted cells</span>
      </button>
      <button type="button" data-delete-art="${piece.id}">Delete</button>
    </article>
  `).join("");
  $$("[data-load-art]").forEach((button) => {
    button.addEventListener("click", () => {
      const piece = state.artPieces.find((item) => item.id === button.dataset.loadArt);
      if (!piece) return;
      const size = ART_SIZES.includes(piece.size) ? piece.size : DEFAULT_ART_SIZE;
      state.artName = piece.name;
      state.artSize = size;
      state.artZoom = 1;
      state.artOffsetX = 0;
      state.artOffsetY = 0;
      state.artPixels = piece.pixels.slice(0, size * size);
      while (state.artPixels.length < size * size) state.artPixels.push(null);
      $("#art-name-input").value = state.artName;
      $("#art-size-select").value = String(state.artSize);
      $("#art-zoom-select").value = String(state.artZoom);
      drawPixelArt(buildRamp());
    });
  });
  $$("[data-delete-art]").forEach((button) => {
    button.addEventListener("click", () => {
      state.artPieces = state.artPieces.filter((item) => item.id !== button.dataset.deleteArt);
      writeStore();
      renderArtGallery();
    });
  });
}

function savePixelArt() {
  const name = state.artName.trim() || "Untitled sprite";
  const piece = {
    id: `art-${Date.now()}`,
    name,
    size: state.artSize,
    pixels: state.artPixels.slice(0, state.artSize * state.artSize),
    palette: buildRamp().map((color) => color.hex),
    createdAt: new Date().toISOString()
  };
  state.artPieces = [piece, ...state.artPieces.filter((item) => item.name !== name)].slice(0, 40);
  writeStore();
  renderArtGallery();
  $("#art-status").textContent = "saved";
}

function clearPixelArt() {
  state.artPixels = createBlankArt(state.artSize);
  drawPixelArt(buildRamp());
}

function resetWorkspace() {
  Object.assign(state, {
    selectedId: "sunlit-brass",
    source: "preset",
    name: "Sunlit brass",
    hue: 43,
    saturation: 72,
    environment: "sun",
    dither: "none",
    size: 4,
    sprite: "gem",
    filter: "all",
    importedRamp: null,
    tool: "paint",
    brushIndex: 0,
    artName: "Untitled sprite",
    artSize: DEFAULT_ART_SIZE,
    artZoom: 1,
    artOffsetX: 0,
    artOffsetY: 0,
    panStart: null,
    artPixels: createBlankArt(DEFAULT_ART_SIZE),
    isDrawing: false
  });
  $("#import-input").value = "";
  render();
}

function exportPixelArtPng() {
  const canvas = buildPixelArtCanvas();
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${(state.artName || "pixel-art").toLowerCase().replace(/[^a-z0-9]+/g, "-") || "pixel-art"}.png`;
  link.click();
}

function buildPixelArtCanvas() {
  const size = state.artSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  state.artPixels.forEach((hex, index) => {
    if (!hex) return;
    context.fillStyle = hex;
    context.fillRect(index % size, Math.floor(index / size), 1, 1);
  });
  return canvas;
}

async function copyPixelArtPng() {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    $("#art-status").textContent = "copy unsupported";
    return;
  }
  const canvas = buildPixelArtCanvas();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    $("#art-status").textContent = "copy failed";
    return;
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    $("#art-status").textContent = "PNG copied";
  } catch {
    $("#art-status").textContent = "copy blocked";
  }
}

function renderControls() {
  $("#preset-select").innerHTML = DATA.presets.map((preset) => (
    `<option value="${preset.id}">${preset.name}</option>`
  )).join("");
  $("#preset-select").value = state.selectedId.startsWith("saved-") ? "" : state.selectedId;
  $("#hue-range").value = state.hue;
  $("#saturation-range").value = state.saturation;
  $("#environment-select").value = state.environment;
  $("#dither-select").value = state.dither;
  $("#sprite-select").value = state.sprite;
  $("#palette-name-input").value = state.name;
  $("#art-name-input").value = state.artName;
  $("#art-size-select").value = String(state.artSize);
  $("#art-zoom-select").value = String(state.artZoom);
  $("#hue-output").textContent = `${state.hue} deg`;
  $("#saturation-output").textContent = `${state.saturation}%`;
  $$(".segmented button").forEach((button) => button.classList.toggle("is-active", Number(button.dataset.size) === state.size));
  $$(".filter-tabs button").forEach((button) => button.classList.toggle("is-active", button.dataset.filter === state.filter));
  renderToolButtons();
}

function renderRules() {
  $("#rule-list").innerHTML = DATA.courseRules.map((rule) => (
    `<article><strong>${rule.name}</strong><p>${rule.detail}</p></article>`
  )).join("");
}

function renderSwatches(ramp) {
  const strip = $("#swatch-strip");
  strip.style.setProperty("--swatch-count", String(ramp.length));
  strip.innerHTML = ramp.map((color) => {
    const ink = contrastRatio(color.rgb, [255, 255, 255]) > contrastRatio(color.rgb, [28, 32, 29]) ? "#fff" : "#1c201d";
    return `<button class="swatch" type="button" data-copy="${color.hex}" style="background:${color.hex};--swatch-ink:${ink}"><code>${color.hex}</code></button>`;
  }).join("");
  $$(".swatch").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.copy)));
}

function renderValueMap(ramp) {
  const strip = $("#value-strip");
  strip.style.setProperty("--swatch-count", String(ramp.length));
  strip.innerHTML = ramp.map((color) => {
    const value = Math.round(relativeLuminance(color.rgb) * 255);
    return `<div style="background:rgb(${value}, ${value}, ${value})"></div>`;
  }).join("");

  const contrasts = ramp.slice(1).map((color, index) => contrastRatio(ramp[index].rgb, color.rgb));
  const spread = Math.round((relativeLuminance(ramp[ramp.length - 1].rgb) - relativeLuminance(ramp[0].rgb)) * 100);
  const minContrast = contrasts.length ? Math.min(...contrasts) : 0;
  $("#spread-score").textContent = String(spread);
  $("#contrast-score").textContent = `${minContrast.toFixed(1)}x`;
  $("#color-count").textContent = String(ramp.length);
  $("#diagnostic-list").innerHTML = [
    ["Shadow", ramp[0].hex],
    ["Mid", ramp[Math.floor(ramp.length / 2)].hex],
    ["Highlight", ramp[ramp.length - 1].hex],
    ["Adjacent contrast", minContrast >= 1.35 ? "Readable" : "Tight"]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function galleryItems() {
  const presets = DATA.presets.map((preset) => ({ ...preset, source: "preset" }));
  const saved = state.saved.map((item) => ({ ...item, source: "saved" }));
  const all = [...saved, ...presets];
  if (state.filter === "liked") return all.filter((item) => state.liked.includes(item.id));
  if (state.filter === "presets") return presets;
  if (state.filter === "saved") return saved;
  return all;
}

function rampForItem(item) {
  if (item.ramp) return item.ramp.map((hex) => ({ hex, rgb: hexToRgb(hex) }));
  const previous = { hue: state.hue, saturation: state.saturation, environment: state.environment, size: state.size, importedRamp: state.importedRamp };
  state.hue = item.hue;
  state.saturation = item.saturation;
  state.environment = item.environment;
  state.size = item.size || 4;
  state.importedRamp = item.importedRamp || null;
  const ramp = buildRamp();
  Object.assign(state, previous);
  return ramp;
}

function renderGallery() {
  const items = galleryItems();
  $("#gallery-count").textContent = `${items.length} shown`;
  if (!items.length) {
    $("#gallery-grid").innerHTML = `<div class="empty-state">No palettes in this view yet.</div>`;
    return;
  }
  $("#gallery-grid").innerHTML = items.map((item) => {
    const ramp = rampForItem(item).map((color) => color.hex);
    const liked = state.liked.includes(item.id) ? "Liked" : "Like";
    const deleteButton = item.source === "saved" ? `<button type="button" data-delete="${item.id}">Delete</button>` : "";
    return `
      <article class="palette-card">
        <button type="button" data-load="${item.id}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.source)}</span>
        </button>
        <div class="mini-ramp" style="--mini-count:${ramp.length}">
          ${ramp.map((hex) => `<span style="background:${hex}"></span>`).join("")}
        </div>
        <div class="header-actions">
          <button type="button" data-like="${item.id}" aria-pressed="${state.liked.includes(item.id)}">${liked}</button>
          ${deleteButton}
        </div>
      </article>
    `;
  }).join("");

  $$("[data-load]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.load;
      const saved = state.saved.find((item) => item.id === id);
      if (saved) setFromSaved(saved);
      else setPreset(id);
    });
  });
  $$("[data-like]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.like;
      state.liked = state.liked.includes(id) ? state.liked.filter((item) => item !== id) : [...state.liked, id];
      writeStore();
      render();
    });
  });
  $$("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteSaved(button.dataset.delete)));
}

function render() {
  const ramp = buildRamp();
  const id = paletteIdFromState();
  const sourceLabel = state.source === "saved" ? "Saved palette" : state.source === "import" ? "Imported palette" : "Built-in preset";
  const preset = DATA.presets.find((item) => item.id === state.selectedId);
  $("#palette-title").textContent = state.name;
  $("#palette-source").textContent = sourceLabel;
  $("#palette-note").textContent = preset?.note || "A custom ramp tuned from the current controls.";
  $("#preview-caption").textContent = `${state.sprite}, ${state.dither}`;
  $("#like-button").textContent = state.liked.includes(id) ? "Liked" : "Like";
  $("#like-button").setAttribute("aria-pressed", String(state.liked.includes(id)));
  $("#export-output").value = exportText("hex");
  renderControls();
  renderRules();
  renderSwatches(ramp);
  renderValueMap(ramp);
  drawSprite(ramp);
  renderBrushes(ramp);
  drawPixelArt(ramp);
  renderArtGallery();
  renderGallery();
  syncUrl();
}

function bindEvents() {
  $("#preset-select").addEventListener("change", (event) => setPreset(event.target.value));
  $("#hue-range").addEventListener("input", (event) => {
    Object.assign(state, { selectedId: "", source: "custom", importedRamp: null, hue: Number(event.target.value) });
    render();
  });
  $("#saturation-range").addEventListener("input", (event) => {
    Object.assign(state, { selectedId: "", source: "custom", importedRamp: null, saturation: Number(event.target.value) });
    render();
  });
  $("#environment-select").addEventListener("change", (event) => {
    Object.assign(state, { selectedId: "", source: "custom", importedRamp: null, environment: event.target.value });
    render();
  });
  $("#dither-select").addEventListener("change", (event) => {
    state.dither = event.target.value;
    render();
  });
  $("#sprite-select").addEventListener("change", (event) => {
    state.sprite = event.target.value;
    render();
  });
  $("#palette-name-input").addEventListener("input", (event) => {
    state.name = event.target.value;
    render();
  });
  $("#art-name-input").addEventListener("input", (event) => {
    state.artName = event.target.value;
  });
  $("#art-size-select").addEventListener("change", (event) => {
    resizePixelArt(Number(event.target.value));
  });
  $("#art-zoom-select").addEventListener("change", (event) => {
    setArtZoom(Number(event.target.value));
  });
  $$(".segmented button").forEach((button) => {
    button.addEventListener("click", () => {
      state.size = Number(button.dataset.size);
      render();
    });
  });
  $$(".filter-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      render();
    });
  });
  $("#like-button").addEventListener("click", toggleLike);
  $("#save-button").addEventListener("click", savePalette);
  $("#reset-button").addEventListener("click", resetWorkspace);
  $$("#art-canvas").forEach((canvas) => {
    canvas.addEventListener("pointerdown", (event) => {
      state.isDrawing = true;
      canvas.setPointerCapture(event.pointerId);
      if (state.tool === "pan") {
        state.panStart = {
          x: event.clientX,
          y: event.clientY,
          offsetX: state.artOffsetX,
          offsetY: state.artOffsetY
        };
      } else {
        paintArtCell(event);
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.isDrawing) return;
      if (state.tool === "pan" && state.panStart) {
        const rect = canvas.getBoundingClientRect();
        const visible = visibleArtCells();
        const deltaX = Math.round(((state.panStart.x - event.clientX) / rect.width) * visible);
        const deltaY = Math.round(((state.panStart.y - event.clientY) / rect.height) * visible);
        state.artOffsetX = state.panStart.offsetX + deltaX;
        state.artOffsetY = state.panStart.offsetY + deltaY;
        clampArtViewport();
        drawPixelArt(buildRamp());
      } else {
        paintArtCell(event);
      }
    });
    canvas.addEventListener("pointerup", () => {
      state.isDrawing = false;
      state.panStart = null;
    });
    canvas.addEventListener("pointercancel", () => {
      state.isDrawing = false;
      state.panStart = null;
    });
  });
  $$("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      renderToolButtons();
      drawPixelArt(buildRamp());
    });
  });
  $("#save-art-button").addEventListener("click", savePixelArt);
  $("#copy-art-button").addEventListener("click", copyPixelArtPng);
  $("#clear-art-button").addEventListener("click", clearPixelArt);
  $("#export-art-button").addEventListener("click", exportPixelArtPng);
  $("#import-button").addEventListener("click", () => {
    const imported = parseHexList($("#import-input").value);
    if (!imported.length) return;
    state.importedRamp = imported;
    state.size = imported.length <= 4 ? 4 : imported.length <= 8 ? 8 : 16;
    state.source = "import";
    state.selectedId = "";
    render();
  });
  $$("[data-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const text = exportText(button.dataset.export);
      $("#export-output").value = text;
      copyText(text);
    });
  });
  $("#copy-url-button").addEventListener("click", () => copyText(window.location.href));
}

readStore();
applyShareState();
bindEvents();
render();
