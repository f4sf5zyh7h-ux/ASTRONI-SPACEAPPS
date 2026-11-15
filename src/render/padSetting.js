import * as THREE from 'three';
import { SUN_DIR } from './space.js';

// Daytime surroundings for the launch pad: sky dome with sun, coastal scrubland with an ocean
// to the east, scattered trees, haze. Everything fades out with altitude so the full-size
// Earth layer (earthLayer.js) takes over as the rocket climbs. 1 unit = 1 m.

const HORIZON = new THREE.Color(0.72, 0.84, 0.96);

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 sunDir; uniform float opacity;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  vec3 zenith = vec3(0.16, 0.38, 0.82);
  vec3 horizon = vec3(0.72, 0.84, 0.96);
  vec3 col = mix(horizon, zenith, pow(h, 0.45));
  if (d.y < 0.0) col = horizon * 0.92;
  float s = max(dot(d, sunDir), 0.0);
  col += vec3(1.0, 0.95, 0.8) * (pow(s, 900.0) * 6.0 + pow(s, 10.0) * 0.25);
  gl_FragColor = vec4(col, opacity);
}`;

export function createPadSetting(scene) {
  const sunDir = SUN_DIR.clone();
  // Sky dome: follows the camera, drawn first, fades to transparent with altitude.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(9000, 32, 16),
    new THREE.ShaderMaterial({
      uniforms: { sunDir: { value: sunDir }, opacity: { value: 1 } },
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: THREE.BackSide, depthWrite: false, transparent: true, fog: false,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.Fog(HORIZON.clone(), 1500, 30000);

  // Daylight.
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.6);
  sun.position.copy(sunDir).multiplyScalar(500);
  const fill = new THREE.HemisphereLight(0xa8ccff, 0x55513f, 1.1);
  scene.add(sun, sun.target, fill);

  // Land (scrub), beach, ocean to the east (+X far side), service road.
  const land = new THREE.Group();
  const flat = (geo, color, x, z, y = 0, extra = {}) => {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, ...extra }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    land.add(m);
    return m;
  };
  flat(new THREE.PlaneGeometry(80000, 80000), 0x6d7a45, 0, 0, -1.6, { polygonOffset: true, polygonOffsetFactor: 8, polygonOffsetUnits: 8 }); // layers spaced apart so they don't flicker from altitude
  flat(new THREE.PlaneGeometry(400, 80000), 0xd9c9a0, 2600, 0, -0.6);
  flat(new THREE.PlaneGeometry(40000, 80000), 0x2f6f9a, 22800, 0, -0.58, { roughness: 0.25, metalness: 0.1 });
  flat(new THREE.PlaneGeometry(18, 2400), 0x8a8a86, 0, -1260, -0.55); // continues the pad model's crawlerway

  // Trees: low-poly cones scattered around, none on the pad or the road.
  const treeGeo = new THREE.ConeGeometry(2.2, 7, 6).translate(0, 3.5, 0);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 1, transparent: true }), 700);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < trees.count; i++) {
    let x;
    let z;
    do {
      const r = 90 + Math.random() * 2300;
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } while (x > 2300 || (Math.abs(x) < 20 && z < 0) || Math.hypot(x, z) < 170); // not on the pad or road
    const s = 0.7 + Math.random() * 0.9;
    m4.makeScale(s, s * (0.8 + Math.random() * 0.6), s).setPosition(x, -0.6, z);
    trees.setMatrixAt(i, m4);
  }
  land.add(trees);
  scene.add(land);

  const fadeMats = [];
  land.traverse((o) => { if (o.material) fadeMats.push(o.material); });

  return {
    sun,
    fill,
    /** Keep the dome on the camera; fade sky, haze and land with altitude (km). */
    update(camera, altKm) {
      sky.position.copy(camera.position);
      const skyFade = 1 - THREE.MathUtils.smoothstep(altKm, 12, 55);
      sky.material.uniforms.opacity.value = skyFade;
      sky.visible = skyFade > 0.001;
      const landFade = 1 - THREE.MathUtils.smoothstep(altKm, 8, 30);
      for (const m of fadeMats) m.opacity = landFade;
      land.visible = landFade > 0.001;
      scene.fog.far = 30000 + altKm * 4000;
      scene.fog.near = 1500 + altKm * 1000;
      if (altKm > 0) fill.intensity = 1.1 * Math.max(0.15, skyFade); // (boarding dims it itself at 0 km)
    },
  };
}
