# Pixel Ramp Lab

<https://yonatankarp.github.io/pixel-ramp-lab/>

A static browser app for designing pixel-art color ramps, previewing them on tiny sprites, saving favorites, and exporting palettes for creative tools.

This repo was promoted from the OpenClaw surprise artifact:

`projects/surprises/2026-06-11-pixel-ramp-lab`

## Features

- Four, eight, and sixteen color ramp generation
- Course-inspired presets and rules from the Pixel Art Master Course notes
- Environment-aware ramps for sun, moon, cave, overcast, and neon lighting
- Local likes and saved palettes using browser storage
- Filter to all palettes, liked palettes, built-in presets, or saved palettes
- Shareable URL state
- Copy/export as hex list, CSS variables, Aseprite GPL, or JSON
- Canvas sprite previews with dithering and value/contrast diagnostics
- Built-in pixel editor with adjustable canvas size, local saved artwork, and PNG export

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 5173
```

Then open `http://127.0.0.1:5173`.

No build step or package install is required.

## Deploy

The site deploys to GitHub Pages from `main` through `.github/workflows/pages.yml`.

CI runs a dependency-free smoke test on every push and pull request.

## Validation

```bash
node tools/smoke-test.mjs
```
