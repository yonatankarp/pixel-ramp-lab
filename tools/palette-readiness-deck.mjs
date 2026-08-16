#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const workspace = "/home/yonatan/.openclaw/workspace";
const projectRoot = path.join(workspace, "projects/pixel-ramp-lab");
const date = process.argv.find((arg) => arg.startsWith("--date="))?.slice("--date=".length) || "2026-08-16";
const slug = `${date}-palette-readiness-deck`;
const outDir = path.join(projectRoot, "artifacts", slug);

const presetsPath = path.join(projectRoot, "data/presets.json");
const appPath = path.join(projectRoot, "app.js");
const smokePath = path.join(projectRoot, "tools/smoke-test.mjs");
const presetsData = JSON.parse(readFileSync(presetsPath, "utf8"));
const appSource = readFileSync(appPath, "utf8");

const environments = {
  sun: { hue: [-30, -8, 8, 24], sat: [-22, -6, 5, -8], light: [13, 31, 58, 83] },
  moon: { hue: [24, 10, -4, -18], sat: [-34, -18, -8, -16], light: [10, 28, 52, 78] },
  cave: { hue: [-16, -6, 7, 18], sat: [-20, 0, 8, -10], light: [7, 22, 46, 72] },
  overcast: { hue: [10, 4, -2, -8], sat: [-38, -24, -14, -22], light: [17, 36, 59, 80] },
  neon: { hue: [-42, -12, 10, 38], sat: [8, 18, 22, 4], light: [8, 32, 61, 86] }
};

const masks = {
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
  ]
};

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

function buildRamp(preset, size = 4) {
  const env = environments[preset.environment] || environments.sun;
  return Array.from({ length: size }, (_, index) => {
    const t = size === 1 ? 0 : index / (size - 1);
    const hue = wrapHue(preset.hue + interpolate(env.hue, t));
    const saturation = clamp(preset.saturation + interpolate(env.sat, t), 8, 98);
    const light = interpolate(env.light, t);
    const rgb = hslToRgb(hue, saturation, light);
    return { hex: rgbToHex(rgb), rgb, light: Math.round(light), hue: Math.round(hue), saturation: Math.round(saturation) };
  });
}

function spriteSvg(ramp, kind) {
  const rows = masks[kind];
  const size = 8;
  const rects = rows.flatMap((row, y) => row.split("").map((cell, x) => {
    if (cell === "0") return "";
    const color = ramp[Number(cell) - 1]?.hex || "#000";
    return `<rect x="${x * size}" y="${y * size}" width="${size}" height="${size}" fill="${color}"/>`;
  })).join("");
  return `<svg viewBox="0 0 128 96" role="img" aria-label="${kind} sprite">${rects}</svg>`;
}

function html(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function scorePreset(preset) {
  const ramp = buildRamp(preset, 4);
  const adjacent = ramp.slice(1).map((color, index) => contrastRatio(ramp[index].rgb, color.rgb));
  const minAdjacent = Math.min(...adjacent);
  const totalContrast = contrastRatio(ramp[0].rgb, ramp.at(-1).rgb);
  const lightSpread = ramp.at(-1).light - ramp[0].light;
  const exportLine = ramp.map((color) => color.hex).join(" ");
  const verdict = minAdjacent >= 1.75 ? "safe" : minAdjacent >= 1.35 ? "usable" : "tight";
  const bestUse = {
    sun: "treasure, warm terrain, readable pickups",
    moon: "night foliage, quiet hazards, low-noise tiles",
    cave: "crystals, damage marks, foreground accents",
    overcast: "metal, stone, UI frames, wet surfaces",
    neon: "magic effects, active pickups, visual callouts"
  }[preset.environment] || "general sprites";

  return {
    ...preset,
    ramp,
    adjacentContrast: adjacent.map((value) => Number(value.toFixed(2))),
    minAdjacentContrast: Number(minAdjacent.toFixed(2)),
    totalContrast: Number(totalContrast.toFixed(2)),
    lightSpread,
    verdict,
    bestUse,
    exportLine
  };
}

const cards = presetsData.presets.map(scorePreset).sort((a, b) => b.minAdjacentContrast - a.minAdjacentContrast);
const strongest = cards[0];
const tightest = cards.at(-1);
const safeCount = cards.filter((card) => card.verdict === "safe").length;
const appSignals = {
  presetsInData: presetsData.presets.length,
  courseRules: presetsData.courseRules.length,
  appHasShareState: appSource.includes("encodeShareState") && appSource.includes("URLSearchParams"),
  appHasAsepriteExport: appSource.includes("GIMP Palette"),
  appHasPixelEditor: appSource.includes("savePixelArt") && appSource.includes("copyPixelArtPng"),
  smokeChecks: (readFileSync(smokePath, "utf8").match(/\["/g) || []).length
};

const data = {
  schema: "morning-surprise.pixel-ramp-lab.palette-readiness-deck.v1",
  generatedAt: new Date().toISOString(),
  artifactDate: date,
  title: "Pixel Ramp Lab Palette Readiness Deck",
  purpose: "Rank the built-in Pixel Ramp Lab presets by adjacent color readability and turn them into a quick asset-picking deck.",
  recommendation: `Use ${strongest.name} when readability matters most; treat ${tightest.name} as the first candidate for manual contrast tuning before using it on tiny sprites.`,
  counts: {
    presets: cards.length,
    safePresets: safeCount,
    courseRules: presetsData.courseRules.length,
    smokeChecks: appSignals.smokeChecks
  },
  cards,
  appSignals,
  provenance: {
    sourceFiles: [
      "projects/pixel-ramp-lab/data/presets.json",
      "projects/pixel-ramp-lab/app.js",
      "projects/pixel-ramp-lab/tools/smoke-test.mjs"
    ],
    generatedFiles: [
      `projects/pixel-ramp-lab/artifacts/${slug}/data.json`,
      `projects/pixel-ramp-lab/artifacts/${slug}/report.md`,
      `projects/pixel-ramp-lab/artifacts/${slug}/index.html`
    ]
  }
};

function renderHtml() {
  const cardHtml = cards.map((card, index) => `
    <article class="palette ${card.verdict}">
      <div class="rank">#${index + 1}</div>
      <div>
        <h2>${html(card.name)}</h2>
        <p>${html(card.note)}</p>
      </div>
      <div class="metric">
        <strong>${card.minAdjacentContrast}x</strong>
        <span>weakest adjacent contrast</span>
      </div>
      <div class="swatches">${card.ramp.map((color) => `<span style="background:${color.hex}">${color.hex}</span>`).join("")}</div>
      <div class="sprites">${spriteSvg(card.ramp, "gem")}${spriteSvg(card.ramp, "tile")}</div>
      <dl>
        <div><dt>Use for</dt><dd>${html(card.bestUse)}</dd></div>
        <div><dt>Ramp</dt><dd><code>${card.exportLine}</code></dd></div>
        <div><dt>Verdict</dt><dd>${card.verdict}</dd></div>
      </dl>
    </article>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pixel Ramp Lab Palette Readiness Deck</title>
  <style>
    :root { color-scheme: light; --ink: #17201b; --muted: #5f6b64; --line: #d9dfd8; --paper: #f6f4ed; --panel: #ffffff; --accent: #0f766e; --warn: #9a3412; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { width: min(1180px, calc(100vw - 40px)); margin: 0 auto; padding: 36px 0 48px; }
    header { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: end; margin-bottom: 26px; border-bottom: 1px solid var(--line); padding-bottom: 22px; }
    h1 { margin: 0; font-size: clamp(2rem, 4vw, 4.8rem); line-height: .96; max-width: 760px; }
    p { color: var(--muted); line-height: 1.55; margin: 8px 0 0; }
    .stamp { border: 1px solid var(--line); padding: 12px 14px; background: #fff; font-size: .82rem; color: var(--muted); min-width: 220px; }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 22px 0 26px; }
    .stat, .palette { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .stat { padding: 16px; }
    .stat strong { display: block; font-size: 1.8rem; line-height: 1; }
    .stat span { display: block; color: var(--muted); margin-top: 6px; font-size: .86rem; }
    .verdict { font-size: 1.05rem; background: #e8f4f0; border: 1px solid #b8d8cf; padding: 16px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .palette { padding: 16px; display: grid; grid-template-columns: 42px 1fr 150px; gap: 14px; align-items: start; }
    .palette.tight { border-color: #efc5a8; }
    .rank { width: 34px; height: 34px; display: grid; place-items: center; background: #17201b; color: #fff; border-radius: 50%; font-weight: 800; }
    h2 { margin: 0; font-size: 1.18rem; }
    .metric { text-align: right; color: var(--muted); }
    .metric strong { color: var(--accent); font-size: 1.7rem; display: block; }
    .swatches { grid-column: 2 / 4; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); overflow: hidden; border: 1px solid var(--line); border-radius: 6px; }
    .swatches span { min-height: 54px; display: flex; align-items: end; padding: 8px; font: 700 .72rem ui-monospace, SFMono-Regular, Menlo, monospace; color: #fff; text-shadow: 0 1px 2px #000; }
    .sprites { grid-column: 1 / 2; display: grid; gap: 8px; }
    svg { width: 100%; image-rendering: pixelated; background: #eef0eb; border: 1px solid var(--line); }
    dl { grid-column: 2 / 4; margin: 0; display: grid; gap: 8px; }
    dl div { display: grid; grid-template-columns: 72px 1fr; gap: 10px; border-top: 1px solid var(--line); padding-top: 8px; }
    dt { color: var(--muted); font-size: .78rem; text-transform: uppercase; }
    dd { margin: 0; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .82rem; white-space: normal; }
    footer { margin-top: 22px; color: var(--muted); font-size: .86rem; }
    @media (max-width: 860px) {
      main { width: min(100vw - 24px, 680px); padding-top: 22px; }
      header, .grid, .stats { grid-template-columns: 1fr; }
      .palette { grid-template-columns: 38px 1fr; }
      .metric, .swatches, dl { grid-column: 1 / 3; text-align: left; }
      .sprites { grid-column: 1 / 3; grid-template-columns: repeat(2, 1fr); }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Palette readiness deck</h1>
        <p>Built from Pixel Ramp Lab's real presets and the same ramp math used by the browser app.</p>
      </div>
      <div class="stamp">Generated ${html(data.generatedAt)}<br>Source: ${html(data.provenance.sourceFiles[0])}</div>
    </header>
    <section class="stats" aria-label="summary">
      <div class="stat"><strong>${data.counts.presets}</strong><span>built-in presets ranked</span></div>
      <div class="stat"><strong>${data.counts.safePresets}</strong><span>safe adjacent-contrast presets</span></div>
      <div class="stat"><strong>${data.counts.courseRules}</strong><span>course rules in source data</span></div>
      <div class="stat"><strong>${data.counts.smokeChecks}</strong><span>app smoke assertions available</span></div>
    </section>
    <section class="verdict"><strong>Recommendation:</strong> ${html(data.recommendation)}</section>
    <section class="grid">${cardHtml}</section>
    <footer>Local-only artifact. No external listing, user storage, or browser state was read.</footer>
  </main>
</body>
</html>`;
}

function renderReport() {
  return `# Pixel Ramp Lab Palette Readiness Deck

Generated: ${data.generatedAt}

## What shipped

A project-local, browser-readable palette readiness deck for Pixel Ramp Lab. It ranks the built-in presets by weakest adjacent contrast, shows the exact hex ramps, and renders small gem/tile sprite previews so the safest starting palette is obvious before opening the editor.

## Recommendation

${data.recommendation}

## Evidence

- Source presets: \`${data.provenance.sourceFiles[0]}\`
- Source app algorithm: \`${data.provenance.sourceFiles[1]}\`
- App smoke test source: \`${data.provenance.sourceFiles[2]}\`
- Presets ranked: ${data.counts.presets}
- Safe adjacent-contrast presets: ${data.counts.safePresets}
- Strongest preset: ${strongest.name} (${strongest.minAdjacentContrast}x weakest adjacent contrast)
- Tightest preset: ${tightest.name} (${tightest.minAdjacentContrast}x weakest adjacent contrast)

## Caveats

- This is a static read-only deck generated from built-in presets, not browser localStorage or saved user palettes.
- Contrast scores are a deterministic proxy for tiny-sprite readability; final art still needs visual review in the editor.
- The ramp math is mirrored from \`app.js\` so this should be regenerated if Pixel Ramp Lab changes its generator.
`;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "data.json"), `${JSON.stringify(data, null, 2)}\n`);
writeFileSync(path.join(outDir, "index.html"), renderHtml());
writeFileSync(path.join(outDir, "report.md"), renderReport());

console.log(JSON.stringify({
  ok: true,
  artifact: path.relative(workspace, outDir),
  strongest: strongest.name,
  tightest: tightest.name,
  presets: data.counts.presets
}, null, 2));
