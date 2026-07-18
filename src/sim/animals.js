// Autonomous animal simulations — pure module (no three imports).
// Every sim is deterministic given its Rng, delta-time driven, and exposes
// plain-data pose state that a view layer can map onto meshes.

import { clamp01, lerp } from './controls.js';
import { waveHeight } from './waves.js';

function turnToward(heading, target, maxTurn) {
  let d = target - heading;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const step = Math.max(-maxTurn, Math.min(maxTurn, d));
  return heading + step;
}

// ---------------------------------------------------------------- deer ----
// States: walk -> graze -> idle -> alert. Alert interrupts when disturbed.
export class DeerSim {
  constructor(rng, spot) {
    this.rng = rng;
    this.x = spot.x;
    this.z = spot.z;
    this.heading = rng.float(0, Math.PI * 2);
    this.state = 'idle';
    this.stateTime = rng.float(0.5, 2);
    this.speed = 0;
    this.legPhase = rng.float(0, Math.PI * 2);
    this.headDown = 0; // 0 up, 1 grazing
    this.alertness = 0;
    this.waypoint = { x: spot.x, z: spot.z };
    this.pickWaypoint = null; // injected: () => ({x, z})
  }

  _enter(state, minT, maxT) {
    this.state = state;
    this.stateTime = this.rng.float(minT, maxT);
  }

  disturb() {
    if (this.state !== 'alert') this._enter('alert', 1.2, 2.4);
  }

  update(dt) {
    this.stateTime -= dt;
    const grazing = this.state === 'graze';
    this.headDown += ((grazing ? 1 : 0) - this.headDown) * Math.min(1, dt * 3);
    this.alertness += ((this.state === 'alert' ? 1 : 0) - this.alertness) * Math.min(1, dt * 5);

    switch (this.state) {
      case 'walk': {
        const dx = this.waypoint.x - this.x;
        const dz = this.waypoint.z - this.z;
        const dist = Math.hypot(dx, dz);
        const targetHeading = Math.atan2(dz, dx);
        this.heading = turnToward(this.heading, targetHeading, dt * 2.2);
        this.speed = lerp(this.speed, 1.35, Math.min(1, dt * 2));
        this.x += Math.cos(this.heading) * this.speed * dt;
        this.z += Math.sin(this.heading) * this.speed * dt;
        this.legPhase += this.speed * dt * 3.4;
        if (dist < 1.2 || this.stateTime <= 0) {
          this.speed = 0;
          this._enter(this.rng.chance(0.62) ? 'graze' : 'idle', 3, 8);
        }
        break;
      }
      case 'graze':
        if (this.stateTime <= 0) this._enter(this.rng.chance(0.25) ? 'idle' : 'walk', 4, 9);
        if (this.state === 'walk') this._newWaypoint();
        break;
      case 'idle':
        if (this.stateTime <= 0) {
          this._enter(this.rng.chance(0.7) ? 'walk' : 'graze', 3, 7);
          if (this.state === 'walk') this._newWaypoint();
        }
        break;
      case 'alert':
        this.speed = 0;
        if (this.stateTime <= 0) this._enter('idle', 1, 3);
        break;
      default:
        this._enter('idle', 1, 2);
    }
  }

  _newWaypoint() {
    if (this.pickWaypoint) this.waypoint = this.pickWaypoint();
  }
}

// ----------------------------------------------------------------- fox ----
// States: rest -> trot -> dash. Dashes hop between cover points quickly.
export class FoxSim {
  constructor(rng, spot) {
    this.rng = rng;
    this.x = spot.x;
    this.z = spot.z;
    this.heading = rng.float(0, Math.PI * 2);
    this.state = 'rest';
    this.stateTime = rng.float(1, 4);
    this.speed = 0;
    this.legPhase = 0;
    this.tailWag = rng.float(0, Math.PI * 2);
    this.waypoint = { x: spot.x, z: spot.z };
    this.pickWaypoint = null;
  }

  _enter(state, minT, maxT) {
    this.state = state;
    this.stateTime = this.rng.float(minT, maxT);
  }

  update(dt) {
    this.stateTime -= dt;
    this.tailWag += dt * (this.state === 'dash' ? 9 : 3);
    if (this.state === 'rest') {
      this.speed = 0;
      if (this.stateTime <= 0) {
        if (this.pickWaypoint) this.waypoint = this.pickWaypoint();
        this._enter(this.rng.chance(0.45) ? 'dash' : 'trot', 6, 14);
      }
      return;
    }
    const dx = this.waypoint.x - this.x;
    const dz = this.waypoint.z - this.z;
    const dist = Math.hypot(dx, dz);
    const dash = this.state === 'dash';
    this.heading = turnToward(this.heading, Math.atan2(dz, dx), dt * (dash ? 4.5 : 2.8));
    this.speed = lerp(this.speed, dash ? 5.2 : 2.1, Math.min(1, dt * 3));
    this.x += Math.cos(this.heading) * this.speed * dt;
    this.z += Math.sin(this.heading) * this.speed * dt;
    this.legPhase += this.speed * dt * 4.2;
    if (dist < 1 || this.stateTime <= 0) {
      this.speed = 0;
      this._enter('rest', 2.5, 7);
    }
  }
}

// ---------------------------------------------------------------- birds ---
// Circling flock above the lake; individuals occasionally dive at the water.
export class BirdSim {
  constructor(rng, index) {
    this.rng = rng;
    this.angle = rng.float(0, Math.PI * 2);
    this.radius = rng.float(14, 42);
    this.height = rng.float(16, 34);
    this.angularSpeed = rng.float(0.1, 0.2) * rng.sign();
    this.flapPhase = rng.float(0, Math.PI * 2);
    this.flapSpeed = rng.float(6, 9);
    this.state = 'circle';
    this.stateTime = rng.float(6, 22) + index;
    this.x = 0;
    this.y = this.height;
    this.z = 0;
    this.heading = 0;
    this.diveT = 0;
  }

  update(dt, time) {
    this.stateTime -= dt;
    if (this.state === 'circle') {
      this.angle += this.angularSpeed * dt;
      const bob = Math.sin(time * 0.7 + this.flapPhase) * 1.4;
      this.x = Math.cos(this.angle) * this.radius;
      this.z = Math.sin(this.angle) * this.radius;
      this.y = this.height + bob;
      this.heading = this.angle + (this.angularSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.flapPhase += dt * this.flapSpeed;
      if (this.stateTime <= 0) {
        this.state = 'dive';
        this.diveT = 0;
      }
    } else {
      // Dive: swoop toward the surface and pull back up over ~2.4s.
      this.diveT += dt / 2.4;
      this.angle += this.angularSpeed * dt * 1.6;
      const swoop = Math.sin(Math.min(1, this.diveT) * Math.PI);
      this.x = Math.cos(this.angle) * this.radius;
      this.z = Math.sin(this.angle) * this.radius;
      this.y = lerp(this.height, 1.2, swoop);
      this.heading = this.angle + (this.angularSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
      this.flapPhase += dt * this.flapSpeed * (1 - swoop * 0.7); // glide mid-dive
      if (this.diveT >= 1) {
        this.state = 'circle';
        this.stateTime = this.rng.float(10, 30);
      }
    }
  }
}

// ---------------------------------------------------------------- ducks ---
export class DuckSim {
  constructor(rng, index) {
    this.rng = rng;
    this.angle = (index / 5) * Math.PI * 2 + rng.float(-0.4, 0.4);
    this.radius = rng.float(8, 30);
    this.angularSpeed = rng.float(0.02, 0.06) * rng.sign();
    this.wobble = rng.float(0, Math.PI * 2);
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.heading = 0;
  }

  update(dt, time, calmness, wind) {
    this.angle += this.angularSpeed * dt;
    this.wobble += dt * 0.8;
    const r = this.radius + Math.sin(this.wobble) * 2.2;
    this.x = Math.cos(this.angle) * r;
    this.z = Math.sin(this.angle) * r;
    this.y = waveHeight(this.x, this.z, time, calmness, wind) * 0.9 + 0.08;
    this.heading = this.angle + (this.angularSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

// ----------------------------------------------------------------- fish ---
// Swim just under the surface so they read through the transparent water;
// periodic arc jumps with splash events at entry/exit.
const SWIM_DEPTH = -0.28;
export class FishSim {
  constructor(rng) {
    this.rng = rng;
    this.angle = rng.float(0, Math.PI * 2);
    this.radius = rng.float(6, 34);
    this.angularSpeed = rng.float(0.05, 0.14) * rng.sign();
    this.state = 'swim';
    this.jumpTimer = rng.float(4, 18);
    this.jumpT = 0;
    this.jumpHeight = rng.float(1.2, 2.4);
    this.x = 0;
    this.y = SWIM_DEPTH;
    this.z = 0;
    this.heading = 0;
    this.splash = null; // set to {x, z} for one frame when a splash happens
  }

  update(dt) {
    this.splash = null;
    if (this.state === 'swim') {
      this.jumpTimer -= dt;
      this.angle += this.angularSpeed * dt;
      this.x = Math.cos(this.angle) * this.radius;
      this.z = Math.sin(this.angle) * this.radius;
      this.y = SWIM_DEPTH;
      this.heading = this.angle + (this.angularSpeed > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (this.jumpTimer <= 0) {
        this.state = 'jump';
        this.jumpT = 0;
        this.jumpHeight = this.rng.float(1.2, 2.6);
        this.splash = { x: this.x, z: this.z };
      }
    } else {
      this.jumpT += dt / 1.1;
      const t = Math.min(1, this.jumpT);
      this.angle += this.angularSpeed * dt * 2.2;
      this.x = Math.cos(this.angle) * this.radius;
      this.z = Math.sin(this.angle) * this.radius;
      this.y = SWIM_DEPTH + Math.sin(t * Math.PI) * (this.jumpHeight - SWIM_DEPTH);
      if (this.jumpT >= 1) {
        this.state = 'swim';
        this.jumpTimer = this.rng.float(6, 22);
        this.splash = { x: this.x, z: this.z };
      }
    }
  }
}

// ------------------------------------------------------------- fireflies ---
export class FireflySim {
  constructor(rng, anchors, count) {
    this.rng = rng;
    this.points = [];
    for (let i = 0; i < count; i++) {
      const a = anchors[rng.int(0, anchors.length)];
      this.points.push({
        ax: a.x,
        az: a.z,
        x: a.x,
        y: rng.float(0.4, 3),
        z: a.z,
        phase: rng.float(0, Math.PI * 2),
        speed: rng.float(0.4, 1.2),
        radius: rng.float(0.6, 3.2),
        twinkle: rng.float(2, 6)
      });
    }
  }

  // Writes xyz + brightness into out (Float32Array of 4 per point).
  update(dt, time, density, out) {
    const n = this.points.length;
    const active = Math.round(n * clamp01(density));
    for (let i = 0; i < n; i++) {
      const p = this.points[i];
      p.phase += dt * p.speed;
      const o = i * 4;
      if (i >= active) {
        out[o + 3] = 0;
        continue;
      }
      out[o] = p.ax + Math.cos(p.phase) * p.radius + Math.sin(p.phase * 2.7) * 0.5;
      out[o + 1] = p.y + Math.sin(p.phase * 1.3 + p.az) * 0.8;
      out[o + 2] = p.az + Math.sin(p.phase * 0.9) * p.radius;
      out[o + 3] = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * p.twinkle + p.phase * 3));
    }
    return active;
  }
}
