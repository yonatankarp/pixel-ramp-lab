#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const workspace = "/home/yonatan/.openclaw/workspace";
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(workspace, "projects/mission-control/node_modules/playwright"));

const date = process.argv.find((arg) => arg.startsWith("--date="))?.slice("--date=".length) || "2026-08-16";
const slug = `${date}-palette-readiness-deck`;
const dir = path.join(workspace, "projects/pixel-ramp-lab/artifacts", slug);
const dataPath = path.join(dir, "data.json");
const htmlPath = path.join(dir, "index.html");
const reportPath = path.join(dir, "report.md");
const screenshotPath = path.join(dir, "screenshot.png");

function fail(message) {
  console.error(message);
  process.exit(1);
}

for (const file of [dataPath, htmlPath, reportPath]) {
  if (!existsSync(file)) fail(`Missing artifact: ${path.relative(workspace, file)}`);
}

const data = JSON.parse(readFileSync(dataPath, "utf8"));
const html = readFileSync(htmlPath, "utf8");
const report = readFileSync(reportPath, "utf8");

if (data.schema !== "morning-surprise.pixel-ramp-lab.palette-readiness-deck.v1") fail("Unexpected schema.");
if (data.cards.length !== data.counts.presets) fail("Card count mismatch.");
if (data.counts.presets < 6) fail("Expected at least six presets.");
if (!data.cards.every((card) => card.ramp.length === 4 && card.exportLine.includes("#"))) fail("Malformed ramp data.");
if (!html.includes("<title>Pixel Ramp Lab Palette Readiness Deck</title>")) fail("HTML title missing.");
if (!report.includes(data.recommendation)) fail("Report recommendation missing.");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
await page.goto(`file://${htmlPath}`);
await page.screenshot({ path: screenshotPath, fullPage: true });
const dom = await page.evaluate(() => ({
  title: document.title,
  h1: document.querySelector("h1")?.textContent,
  paletteCount: document.querySelectorAll(".palette").length,
  swatchCount: document.querySelectorAll(".swatches span").length,
  svgCount: document.querySelectorAll("svg").length,
  bodyText: document.body.innerText,
  width: document.body.scrollWidth,
  height: document.body.scrollHeight
}));
await browser.close();

if (dom.title !== "Pixel Ramp Lab Palette Readiness Deck") fail("Browser title mismatch.");
if (dom.h1 !== "Palette readiness deck") fail("Heading mismatch.");
if (dom.paletteCount !== data.counts.presets) fail("Rendered palette count mismatch.");
if (dom.swatchCount !== data.counts.presets * 4) fail("Rendered swatch count mismatch.");
if (dom.svgCount !== data.counts.presets * 2) fail("Rendered sprite count mismatch.");
if (!dom.bodyText.includes("Recommendation:")) fail("Recommendation not rendered.");
if (dom.width <= 0 || dom.height <= 0) fail("Rendered dimensions invalid.");
if (!existsSync(screenshotPath)) fail("Screenshot missing.");

console.log(JSON.stringify({
  ok: true,
  artifact: path.relative(workspace, dir),
  screenshot: path.relative(workspace, screenshotPath),
  palettes: dom.paletteCount,
  swatches: dom.swatchCount
}, null, 2));
