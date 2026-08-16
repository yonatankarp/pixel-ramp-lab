# Pixel Ramp Lab Palette Readiness Deck

Generated: 2026-08-16T21:30:00.271Z

## What shipped

A project-local, browser-readable palette readiness deck for Pixel Ramp Lab. It ranks the built-in presets by weakest adjacent contrast, shows the exact hex ramps, and renders small gem/tile sprite previews so the safest starting palette is obvious before opening the editor.

## Recommendation

Use Neon plum when readability matters most; treat Sunlit brass as the first candidate for manual contrast tuning before using it on tiny sprites.

## Evidence

- Source presets: `projects/pixel-ramp-lab/data/presets.json`
- Source app algorithm: `projects/pixel-ramp-lab/app.js`
- App smoke test source: `projects/pixel-ramp-lab/tools/smoke-test.mjs`
- Presets ranked: 6
- Safe adjacent-contrast presets: 3
- Strongest preset: Neon plum (1.91x weakest adjacent contrast)
- Tightest preset: Sunlit brass (1.32x weakest adjacent contrast)

## Caveats

- This is a static read-only deck generated from built-in presets, not browser localStorage or saved user palettes.
- Contrast scores are a deterministic proxy for tiny-sprite readability; final art still needs visual review in the editor.
- The ramp math is mirrored from `app.js` so this should be regenerated if Pixel Ramp Lab changes its generator.
