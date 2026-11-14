import * as THREE from 'three';

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
    this.current.enter?.({ renderer: this.renderer, ui: this.ui, manager: this });
    this.resize();
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
      }
      this.onFrame?.(dt);
    });
  }
}
