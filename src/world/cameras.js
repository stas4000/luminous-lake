// Camera director: orbit / cinematic / shore / aerial with lerped transitions.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp01 } from '../sim/controls.js';

export const CAMERA_MODES = ['orbit', 'cinematic', 'shore', 'aerial'];

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export class CameraDirector {
  constructor(camera, domElement) {
    this.camera = camera;
    this.mode = 'orbit';
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = 1.53;
    this.controls.target.set(0, 2, 0);
    this.controls.enabled = true;

    this._blend = 1; // 1 = settled into the scripted path
    this._portrait = false; // narrow viewports get a wider, lower framing
    this._fromPos = new THREE.Vector3();
    this._fromQuat = new THREE.Quaternion();
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();

    // Any manual pointer input returns to orbit mode.
    domElement.addEventListener('pointerdown', () => {
      if (this.mode !== 'orbit') this._userExit && this._userExit();
    });
  }

  onUserExit(fn) {
    this._userExit = fn;
  }

  setMode(mode) {
    if (!CAMERA_MODES.includes(mode) || mode === this.mode) return;
    this._fromPos.copy(this.camera.position);
    this._fromQuat.copy(this.camera.quaternion);
    this._blend = 0;
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      this.controls.target.set(0, this._portrait ? 0.6 : 2, 0);
    }
  }

  // Portrait adaptation: dolly the orbit camera out and aim lower so the
  // lake keeps a visible band instead of a frame full of sky.
  setPortrait(p) {
    if (p === this._portrait) return;
    this._portrait = p;
    if (this.mode === 'orbit') {
      const k = p ? 1.45 : 1 / 1.45;
      this.camera.position.x *= k;
      this.camera.position.z *= k;
      // Rise above the nearby canopies so they don't fill the bottom frame.
      if (p) this.camera.position.y = Math.max(this.camera.position.y, 24);
      this.controls.target.set(0, p ? 0.6 : 2, 0);
    }
  }

  _scriptedPose(mode, time, outPos, outLook) {
    switch (mode) {
      case 'cinematic': {
        const a = time * 0.045;
        const r = 50 + Math.sin(time * 0.11) * 9;
        outPos.set(Math.cos(a) * r, 6.5 + Math.sin(time * 0.07) * 3.2, Math.sin(a) * r);
        outLook.set(Math.cos(a + 2.4) * 8, 1.6, Math.sin(a + 2.4) * 8);
        break;
      }
      case 'shore': {
        const a = 0.8 + Math.sin(time * 0.021) * 0.5;
        outPos.set(Math.cos(a) * 47, 1.7 + Math.sin(time * 0.13) * 0.25, Math.sin(a) * 47);
        const pan = time * 0.05;
        outLook.set(Math.cos(a + Math.PI + Math.sin(pan) * 0.9) * 20, 1.1, Math.sin(a + Math.PI + Math.sin(pan) * 0.9) * 20);
        break;
      }
      case 'aerial': {
        const a = time * 0.03;
        outPos.set(Math.cos(a) * 46, 58 + Math.sin(time * 0.05) * 5, Math.sin(a) * 46);
        outLook.set(0, 0, 0);
        break;
      }
      default:
        break;
    }
    if (this._portrait) {
      // Reframe so water/treeline/sky all fit a tall frame. The shore camera
      // moves INWARD over the water (outward would land inside the forest).
      if (mode === 'shore') {
        outPos.x *= 0.8;
        outPos.z *= 0.8;
        outPos.y = Math.max(outPos.y, 3.2);
        outLook.y = 0.3;
      } else if (mode === 'cinematic') {
        outPos.x *= 1.12;
        outPos.z *= 1.12;
        outPos.y += 4;
        outLook.y = 0.8;
      } else if (mode === 'aerial') {
        outPos.x *= 1.15;
        outPos.z *= 1.15;
        outPos.y += 8;
      }
    }
  }

  update(dt, time) {
    if (this.mode === 'orbit') {
      this.controls.update();
      return;
    }
    this._scriptedPose(this.mode, time, this._pos, this._look);
    this._m.lookAt(this._pos, this._look, this.camera.up);
    this._q.setFromRotationMatrix(this._m);

    this._blend = Math.min(1, this._blend + dt / 1.8);
    const k = smooth(clamp01(this._blend));
    this.camera.position.lerpVectors(this._fromPos, this._pos, k);
    this.camera.quaternion.slerpQuaternions(this._fromQuat, this._q, k);
  }
}
