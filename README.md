# Luminous Lake

A standalone, cinematic 3D lake world built with **Three.js** (WebGPU-first,
with a bulletproof WebGL fallback). A living alpine lake: transparent water
with real wind-driven waves, fish gliding under the surface, a drifting
fishing boat, a procedural forest, dynamic weather, and a full day/night
cycle — all touch-friendly and running smoothly on phones.

**Live demo:** https://forest-lake.bles-software.com

**More to explore:** [20 full-screen UI concepts](https://www.bles-software.com/inspiration/ui-systems/?utm_source=bles-demo&utm_medium=github-luminous-lake&utm_campaign=demo-exit) from Bles Software, the team behind this repo. Free to browse and download, no sign-up.

![Luminous Lake — desktop](docs/screenshots/desktop.png)

## Highlights

- **Transparent physical water** — `MeshPhysicalMaterial` (clearcoat + IOR
  1.333) with CPU vertex waves, a dual-scroll canvas normal map, and live
  `CubeCamera` reflections. Glass-calm water reveals the depth-graded lakebed
  and the fish below; choppy water turns milky, like a real lake.
- **Living ecosystem** — deer, foxes, birds, ducks, silver fish and golden
  koi (with ripple rings and arc jumps), fireflies at dusk.
- **Fishing boat** — wooden hull, outboard motor, rod and lantern; drifts
  around the lake and pitches/rolls on the same wave field as the water.
- **Weather machine** — clear → storm states with rain, lightning, mist
  banks, and wind that drives trees, waves, and the boat.
- **Day/night cycle** — full 24h loop: dawn mist, golden hour, star fields,
  and a crisp moon streak on the night water.
- **Four camera directors** — Orbit (drag to explore), Cinematic, Shore,
  Aerial. Plus sliders for time of day, weather, wind, wildlife, water
  calmness, and mist.
- **Adaptive quality** — an FPS meter drives a quality scaler (reflection
  refresh rate, shadows, pixel-ratio cap, particle counts) so it stays smooth
  on mid-range phones.

| Golden hour | Underwater fish | Mobile |
| --- | --- | --- |
| ![Golden hour](docs/screenshots/golden-hour.png) | ![Fish under transparent water](docs/screenshots/underwater-fish.png) | ![Mobile](docs/screenshots/mobile.png) |

## Quick start

```bash
npm install
npm run dev        # local dev server
npm run check      # unit tests + lint + production build
npm run test:e2e   # Playwright end-to-end (desktop + mobile)
```

Build output lands in `dist/` — serve it with any static file server.

## Tech notes

- WebGPU renderer is attempted first; any failure falls through to the
  classic WebGL renderer, so the world runs everywhere.
- One deterministic sum-of-sines wave field drives the water mesh, the boat,
  the ducks, and the fish ripples, so everything stays in sync.
- All textures (sky, environment, normal maps, glows, clouds, mist) are
  generated on `<canvas>` at runtime — zero binary assets.

## License

MIT © Bles Software
