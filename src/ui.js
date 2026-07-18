// Hand-rolled glassmorphism control panel. No frameworks.
import { CAMERA_MODES } from './world/cameras.js';

const SLIDERS = [
  { key: 'timeOfDay', label: 'Time of Day', setter: 'setTimeOfDay', initial: 0.36 },
  { key: 'weather', label: 'Weather', setter: 'setWeather', initial: 0.1 },
  { key: 'wind', label: 'Wind', setter: 'setWind', initial: 0.35 },
  { key: 'wildlife', label: 'Wildlife', setter: 'setWildlife', initial: 0.65 },
  { key: 'calmness', label: 'Water Calmness', setter: 'setCalmness', initial: 0.62 },
  { key: 'mist', label: 'Mist', setter: 'setMist', initial: 0.35 }
];

const CAMERA_LABELS = { orbit: 'Orbit', cinematic: 'Cinematic', shore: 'Shore', aerial: 'Aerial' };

export function createUI(world) {
  const root = document.getElementById('ui');

  // Title
  const title = document.createElement('div');
  title.id = 'title';
  title.innerHTML = '<span class="title-dot"></span>Luminous Lake';
  root.appendChild(title);

  const panel = document.createElement('div');
  panel.id = 'panel';

  const handle = document.createElement('button');
  handle.id = 'panel-handle';
  handle.type = 'button';
  handle.setAttribute('aria-label', 'Toggle control panel');
  handle.innerHTML = '<span class="chev">▾</span> Controls';
  panel.appendChild(handle);

  const body = document.createElement('div');
  body.id = 'panel-body';
  panel.appendChild(body);
  root.appendChild(panel);

  // Camera segmented buttons
  const camRow = document.createElement('div');
  camRow.id = 'camera-row';
  camRow.setAttribute('role', 'group');
  camRow.setAttribute('aria-label', 'Camera mode');
  const camButtons = {};
  CAMERA_MODES.forEach((mode, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cam-btn';
    b.dataset.mode = mode;
    b.textContent = CAMERA_LABELS[mode];
    b.title = `Camera: ${CAMERA_LABELS[mode]} (${i + 1})`;
    b.addEventListener('click', () => setCameraMode(mode));
    camRow.appendChild(b);
    camButtons[mode] = b;
  });
  body.appendChild(camRow);

  // Sliders
  const grid = document.createElement('div');
  grid.id = 'slider-grid';
  body.appendChild(grid);

  const inputs = {};
  for (const s of SLIDERS) {
    const wrap = document.createElement('label');
    wrap.className = 'slider-wrap';
    const name = document.createElement('span');
    name.className = 'slider-label';
    name.textContent = s.label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '1000';
    input.value = String(Math.round(s.initial * 1000));
    input.dataset.control = s.key;
    input.setAttribute('aria-label', s.label);
    input.addEventListener('input', () => {
      world[s.setter](Number(input.value) / 1000);
    });
    wrap.appendChild(name);
    wrap.appendChild(input);
    grid.appendChild(wrap);
    inputs[s.key] = input;
  }

  function setCameraMode(mode) {
    world.setCameraMode(mode);
    for (const [m, b] of Object.entries(camButtons)) {
      b.classList.toggle('active', m === mode);
    }
  }
  setCameraMode('orbit');

  // Collapse / expand
  handle.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    handle.querySelector('.chev').textContent = panel.classList.contains('collapsed') ? '▴' : '▾';
  });

  // Small screens start scenery-first with the panel collapsed.
  if (window.innerWidth < 620) {
    panel.classList.add('collapsed');
    handle.querySelector('.chev').textContent = '▴';
  }

  // Narrow viewports: start collapsed so the first view is pure scenery.
  if (window.innerWidth < 700) {
    panel.classList.add('collapsed');
    handle.querySelector('.chev').textContent = '▴';
  }

  // Keyboard: 1-4 camera modes
  window.addEventListener('keydown', (e) => {
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx >= 0) setCameraMode(CAMERA_MODES[idx]);
  });

  // Leaving a scripted camera via touch/mouse re-activates the Orbit button
  world.onCameraExit = () => {
    for (const [m, b] of Object.entries(camButtons)) {
      b.classList.toggle('active', m === 'orbit');
    }
  };

  return {
    setCameraMode,
    // Reflect programmatic changes (debug handle) in the widgets.
    sync(key, value) {
      const input = inputs[key];
      if (input) input.value = String(Math.round(value * 1000));
    },
    isCollapsed() {
      return panel.classList.contains('collapsed');
    }
  };
}
