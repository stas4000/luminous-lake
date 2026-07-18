// Boot: WebGPU-first renderer with a bulletproof WebGL fallback, then the
// world, UI, main loop, and the window.__luminous debug handle.
import * as THREE from 'three';
import { createWorld } from './world/world.js';
import { createUI } from './ui.js';

async function createRenderer(canvas) {
  // WebGPU first — any failure at all falls through to WebGL.
  if (navigator.gpu) {
    try {
      const mod = await import('three/webgpu');
      const renderer = new mod.WebGPURenderer({ canvas, antialias: true });
      await renderer.init();
      // Smoke test: some environments expose navigator.gpu but cannot render.
      const testScene = new THREE.Scene();
      const testCam = new THREE.PerspectiveCamera();
      testScene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
      renderer.render(testScene, testCam);
      // The WebGPURenderer silently degrades to a WebGL2 backend when no real
      // WebGPU adapter exists — treat that as unavailable and use the classic
      // renderer, which is better battle-tested for classic materials.
      if (!renderer.backend?.isWebGPUBackend) {
        throw new Error('WebGPU adapter unavailable (WebGL2 backend)');
      }
      return { renderer, type: 'webgpu' };
    } catch (err) {
      console.warn('[luminous-lake] WebGPU unavailable, falling back to WebGL:', err.message || err);
    }
  }
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  return { renderer, type: 'webgl' };
}

function configureRenderer(renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0a1420, 1);
}

async function boot() {
  const canvas = document.getElementById('scene');
  const isMobile =
    matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 620;

  let rendererInfo;
  try {
    rendererInfo = await createRenderer(canvas);
  } catch (err) {
    document.getElementById('loading').innerHTML =
      '<div class="load-card"><h1>Luminous Lake</h1><p>This experience needs WebGL, which your browser blocked.</p></div>';
    throw err;
  }
  const { renderer, type } = rendererInfo;
  configureRenderer(renderer);

  const world = createWorld({ renderer, isMobile });
  const ui = createUI(world);

  function resize() {
    world.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  // Main loop with delta clamp (tab-switch safe)
  let last = performance.now();
  let firstFrame = true;
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0.0005, (now - last) / 1000));
    last = now;
    world.update(dt);
    if (firstFrame) {
      firstFrame = false;
      document.getElementById('loading').classList.add('hidden');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Debug / test handle
  window.__luminous = {
    scene: world.scene,
    renderer,
    world,
    rendererType: type,
    setTimeOfDay: (v) => { world.setTimeOfDay(v); ui.sync('timeOfDay', v); },
    setWeather: (v) => { world.setWeather(v); ui.sync('weather', v); },
    setWind: (v) => { world.setWind(v); ui.sync('wind', v); },
    setWildlife: (v) => { world.setWildlife(v); ui.sync('wildlife', v); },
    setCalmness: (v) => { world.setCalmness(v); ui.sync('calmness', v); },
    setMist: (v) => { world.setMist(v); ui.sync('mist', v); },
    setCameraMode: (m) => { ui.setCameraMode(m); },
    getState: () => ({ ...world.getState(), rendererType: type })
  };
}

boot();
