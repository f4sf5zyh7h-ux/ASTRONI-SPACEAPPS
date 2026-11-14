import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Owns the single WebGL renderer and runs exactly one scene at a time.
 *
 * A scene is an object with:
 *   scene    THREE.Scene
 *   camera   THREE.Camera
 *   enter(ctx)       build UI / controls (ctx = { renderer, ui, manager })
 *   exit()           tear down UI / controls / listeners
 *   update(dt)       per-frame logic, dt in seconds
 *   resize(w, h)     optional
 *   afterRender()    optional, e.g. draw CSS2D labels
 */
export class SceneManager {
  constructor(canvas, uiRoot) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.ui = uiRoot;
    this.factories = new Map();
    this.current = null;
    this.timer = new THREE.Timer();
    this.onFrame = null;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  register(name, factory) {
    this.factories.set(name, factory);
  }

  go(name, params = {}) {
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`Unknown scene: ${name}`);
    if (this.current) {
      this.current.exit?.();
      this.ui.replaceChildren();
    }
    this.current = factory(params);
    // Metallic GLB materials (from Fusion) render black without something to reflect.
    // Give every scene a soft studio environment unless it sets its own.
    const s = this.current.scene;
    if (s && !s.environment) {
      s.environment = this.envMap();
      s.environmentIntensity = s.userData.envIntensity ?? 0.6;
    }
    this.current.enter?.({ renderer: this.renderer, ui: this.ui, manager: this });
    this.resize();
  }

  /** Shared reflection map (built once). */
  envMap() {
    if (!this._env) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this._env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    }
    return this._env;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const cam = this.current?.camera;
    if (cam?.isPerspectiveCamera) {
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    this.current?.resize?.(w, h);
  }

  start() {
    this.renderer.setAnimationLoop((time) => {
      this.timer.update(time);
      // Clamp dt so a backgrounded tab doesn't produce a giant jump.
      const dt = Math.min(this.timer.getDelta(), 0.1);
      if (this.current) {
        this.current.update?.(dt);
        this.renderer.render(this.current.scene, this.current.camera);
        this.current.afterRender?.();
      }
      this.onFrame?.(dt);
    });
  }
}
