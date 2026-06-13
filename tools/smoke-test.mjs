import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const files = {
  html: readFileSync(resolve(root, "index.html"), "utf8"),
  css: readFileSync(resolve(root, "styles.css"), "utf8"),
  js: readFileSync(resolve(root, "app.js"), "utf8"),
  data: readFileSync(resolve(root, "data/presets.json"), "utf8")
};

const data = JSON.parse(files.data);
const assertions = [
  ["has one h1", (files.html.match(/<h1\b/g) || []).length === 1],
  ["has canvas preview", files.html.includes("<canvas")],
  ["has pixel editor", files.html.includes('id="art-canvas"') && files.js.includes("savePixelArt")],
  ["has adjustable art size", files.html.includes('id="art-size-select"') && files.js.includes("resizePixelArt")],
  ["has editor zoom", files.html.includes('id="art-zoom-select"') && files.js.includes("setArtZoom")],
  ["has copy art png", files.html.includes('id="copy-art-button"') && files.js.includes("copyPixelArtPng")],
  ["has reset button", files.html.includes('id="reset-button"') && files.js.includes("resetWorkspace")],
  ["has liked filter", files.html.includes('data-filter="liked"')],
  ["has no remote scripts", !/<script[^>]+src=["']https?:\/\//.test(files.html)],
  ["has local storage", files.js.includes("localStorage")],
  ["has copy/export support", files.js.includes("GIMP Palette") && files.js.includes("--ramp-") && files.html.includes("CSS vars")],
  ["has presets", Array.isArray(data.presets) && data.presets.length >= 6],
  ["has rules", Array.isArray(data.courseRules) && data.courseRules.length >= 5],
  ["css avoids negative tracking", !/letter-spacing:\s*-/.test(files.css)]
];

const failed = assertions.filter(([, pass]) => !pass);
if (failed.length) {
  console.error("Smoke test failed:");
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Smoke test passed: ${assertions.length} checks`);
