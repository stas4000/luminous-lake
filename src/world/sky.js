// Sky dome, sun/moon, stars, drifting clouds, fog — all classic materials.
import * as THREE from 'three';
import { Rng } from '../sim/rng.js';
import { skyPalette, sunLight, starVisibility, nightFactor } from '../sim/timecycle.js';
import { lerp, clamp01 } from '../sim/controls.js';
import { createSkyTexture, createEnvTexture, makeGlowTexture, makeMoonTexture, makeSunCoreTexture, makeCloudTexture } from './textures.js';

export function createSky({ seed = 777 }) {
  const rng = new Rng(seed);

  // Dome
  const skyTex = createSkyTexture();
  const domeGeo = new THREE.SphereGeometry(390, 32, 18);
  const domeMat = new THREE.MeshBasicMaterial({ map: skyTex.texture, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.name = 'skyDome';
  dome.renderOrder = -10;

  // Environment (PMREM-free equirect, both renderers convert it internally)
  const env = createEnvTexture();

  // Sun: crisp core disc + separate soft glow sprite (high contrast)
  const sunMat = new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(255,244,214,1)', 'rgba(255,214,140,0.5)'), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sun = new THREE.Sprite(sunMat);
  sun.scale.setScalar(72);
  const sunCoreMat = new THREE.SpriteMaterial({ map: makeSunCoreTexture(), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sunCore = new THREE.Sprite(sunCoreMat);
  sunCore.scale.setScalar(17);

  // Moon: bright disc + wide soft halo
  const moonMat = new THREE.SpriteMaterial({ map: makeMoonTexture(), fog: false, transparent: true, depthWrite: false });
  const moon = new THREE.Sprite(moonMat);
  moon.scale.setScalar(42);
  const moonHaloMat = new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(214,228,255,0.95)', 'rgba(160,190,240,0.22)'), fog: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const moonHalo = new THREE.Sprite(moonHaloMat);
  moonHalo.scale.setScalar(115);

  // Stars
  const starCount = 650;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = rng.float(0, Math.PI * 2);
    const phi = Math.acos(rng.float(0.02, 1)); // upper hemisphere
    const r = 375;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xcdd8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.name = 'stars';

  // Clouds
  const cloudTex = makeCloudTexture(rng);
  const clouds = [];
  const cloudGroup = new THREE.Group();
  cloudGroup.name = 'clouds';
  for (let i = 0; i < 15; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const scale = rng.float(60, 130);
    s.scale.set(scale, scale * 0.42, 1);
    const angle = rng.float(0, Math.PI * 2);
    const radius = rng.float(90, 300);
    s.position.set(Math.cos(angle) * radius, rng.float(70, 130), Math.sin(angle) * radius);
    s.userData.drift = rng.float(0.4, 1.2);
    cloudGroup.add(s);
    clouds.push(s);
  }

  // Fog — gentle, starts beyond the far shore so trees stay saturated
  const fog = new THREE.Fog(0xaad4f0, 190, 470);

  // Lights
  const sunLightObj = new THREE.DirectionalLight(0xffffff, 2);
  sunLightObj.castShadow = false;
  sunLightObj.shadow.mapSize.set(2048, 2048);
  sunLightObj.shadow.camera.near = 10;
  sunLightObj.shadow.camera.far = 260;
  const S = 95;
  sunLightObj.shadow.camera.left = -S;
  sunLightObj.shadow.camera.right = S;
  sunLightObj.shadow.camera.top = S;
  sunLightObj.shadow.camera.bottom = -S;
  sunLightObj.shadow.bias = -0.0006;
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x2a3a28, 0.7);
  const ambient = new THREE.AmbientLight(0xffffff, 0.12);

  const group = new THREE.Group();
  group.add(dome, sun, sunCore, moon, moonHalo, stars, cloudGroup, sunLightObj, sunLightObj.target, hemi, ambient);

  let lastPaletteKey = '';
  let flashBrighten = 0;

  const api = {
    group,
    envTexture: env.texture,
    sunLight: sunLightObj,
    hemi,
    ambient,
    fog,
    clouds,
    cloudGroup,
    moonHalo,
    stars,
    setFlash(v) {
      flashBrighten = v;
    },

    // force: regenerate textures even if palette key unchanged
    update(timeOfDay, cloudCover, darkness, dt, wind, force = false) {
      const pal = skyPalette(timeOfDay);
      const light = sunLight(timeOfDay);

      // Weather desaturation/darkening toward gray.
      const gray = (c, k) => {
        const lum = c[0] * 0.3 + c[1] * 0.5 + c[2] * 0.2;
        return c.map((v) => lerp(v, lum, k * 0.7) * (1 - k * 0.55));
      };
      const wk = clamp01(cloudCover * 0.75 + darkness * 0.4);
      const zen = gray(pal.zenith, wk);
      const hor = gray(pal.horizon, wk);

      const key = `${Math.round(zen[0])},${Math.round(zen[1])},${Math.round(zen[2])},${Math.round(hor[0])},${Math.round(hor[1])},${Math.round(hor[2])},${Math.round(light.elevation * 40)},${Math.round(flashBrighten * 10)}`;
      if (force || key !== lastPaletteKey) {
        lastPaletteKey = key;
        const brighten = 1 + flashBrighten * 2.2;
        skyTex.redraw(zen, hor, brighten);
        env.redraw(
          zen.map((v) => v * brighten),
          hor.map((v) => v * brighten),
          light.color,
          light.azimuth,
          light.elevation
        );
        fog.color.setRGB(hor[0] / 255, hor[1] / 255, hor[2] / 255);
      }

      // Sun / moon placement on the dome
      const sunEl = light.isMoon ? -0.3 : Math.max(-0.15, light.elevation);
      if (!light.isMoon) {
        const az = light.azimuth;
        sun.position.set(Math.cos(az) * 340, Math.sin(sunEl * Math.PI * 0.5) * 300 + 20, -Math.sin(az) * 340);
        sunCore.position.copy(sun.position);
        const vis = clamp01(light.elevation * 4 + 0.35) * (1 - cloudCover * 0.85);
        sunMat.opacity = vis * 0.55; // soft glow stays subtle
        sunCoreMat.opacity = vis; // crisp core carries the disc
        const warm = clamp01(1 - light.elevation * 2.2);
        sunMat.color.setRGB(1, lerp(1, 0.72, warm), lerp(1, 0.45, warm));
        sunCoreMat.color.setRGB(1, lerp(1, 0.82, warm), lerp(1, 0.6, warm));
      } else {
        sunMat.opacity = 0;
        sunCoreMat.opacity = 0;
      }
      if (light.isMoon) {
        const az = light.azimuth;
        // Keep the moon low over the treeline so the default orbit view
        // actually frames it (and its reflection streak) — uncapped it
        // rides at ~42°, far above the frame.
        const me = Math.max(0.1, Math.min(0.13, light.elevation));
        moon.position.set(Math.cos(az) * 340, Math.sin(me * Math.PI * 0.5) * 280 + 30, -Math.sin(az) * 340);
        moonHalo.position.copy(moon.position);
        moonMat.opacity = clamp01(0.4 + light.elevation) * (1 - cloudCover * 0.9);
        moonHaloMat.opacity = moonMat.opacity * 0.85;
      } else {
        moonMat.opacity = 0;
        moonHaloMat.opacity = 0;
      }

      // Directional light from whichever body is up
      const laz = light.azimuth;
      const lel = Math.max(0.12, light.elevation);
      sunLightObj.position.set(Math.cos(laz) * 140, lel * 160 + 10, -Math.sin(laz) * 140);
      sunLightObj.target.position.set(0, 0, 0);
      const baseI = light.intensity * (1 - darkness * 0.75) * (1 - cloudCover * 0.45);
      sunLightObj.intensity = baseI + flashBrighten * 5;
      sunLightObj.color.setRGB(light.color[0] / 255, light.color[1] / 255, light.color[2] / 255);

      const nf = nightFactor(timeOfDay);
      hemi.intensity = lerp(0.55, 0.14, nf) * (1 - darkness * 0.65) + flashBrighten * 2;
      const hemiDay = [zen[0] / 255 + 0.25, zen[1] / 255 + 0.28, zen[2] / 255 + 0.35];
      hemi.color.setRGB(
        lerp(hemiDay[0], 0.22, nf),
        lerp(hemiDay[1], 0.3, nf),
        lerp(hemiDay[2], 0.52, nf)
      );
      ambient.intensity = 0.1 + flashBrighten * 1.2;

      // Stars & clouds
      starMat.opacity = starVisibility(timeOfDay) * (1 - cloudCover * 0.92) * (1 - flashBrighten * 0.6);
      const cloudOpacity = (0.1 + cloudCover * 0.66) * clamp01(1.3 - starVisibility(timeOfDay) * 0.4);
      // Low sun tints cloud undersides toward the warm horizon band.
      const cloudWarm = light.isMoon ? 0 : clamp01(1 - light.elevation * 2.2) * 0.75;
      const driftSpeed = (0.9 + wind * 5) * dt;
      for (const c of clouds) {
        c.position.x += c.userData.drift * driftSpeed;
        if (c.position.x > 330) c.position.x = -330;
        c.material.opacity = cloudOpacity * (0.7 + (c.userData.drift - 0.4) * 0.35);
        const shade = (1 - darkness * 0.8) * (1 - nf * 0.62);
        c.material.color.setRGB(
          Math.min(1, shade * lerp(1, (hor[0] / 255) * 1.3, cloudWarm)),
          Math.min(1, shade * lerp(1, (hor[1] / 255) * 1.3, cloudWarm)),
          Math.min(1, shade * lerp(1.02, (hor[2] / 255) * 1.3, cloudWarm))
        );
      }
    }
  };
  return api;
}
