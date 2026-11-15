import * as THREE from 'three';
import { SUN_DIR } from './space.js';

// Daytime surroundings for the launch pad: sky dome with sun, a small island in the open ocean
// (sandy shore, a few trees), haze. Everything fades out with altitude so the full-size
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
  // The pad sits on a small island in the open ocean: sea everywhere, a sandy shore, the pad's grass.
  // Layers are spaced apart vertically so they don't flicker when seen from altitude.
  flat(new THREE.PlaneGeometry(80000, 80000), 0x1f5f8b, 0, 0, -1.6, { roughness: 0.22, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: 8, polygonOffsetUnits: 8 });
  flat(new THREE.CircleGeometry(300, 64), 0x2f86a8, 0, 0, -1.2, { roughness: 0.3 }); // shallow water round the island
  flat(new THREE.CircleGeometry(250, 64), 0xd9c9a0, 0, 0, -0.85); // beach
  flat(new THREE.CircleGeometry(222, 64), 0x6d7a45, 0, 0, -0.6); // grass (covers the pad model's square corners)

  // A few palms-ish trees on the island's edge, clear of the pad square and the crawlerway.
  const treeGeo = new THREE.ConeGeometry(2.2, 7, 6).translate(0, 3.5, 0);
  const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 1, transparent: true }), 90);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < trees.count; i++) {
    let x;
    let z;
    do {
      const r = 160 + Math.random() * 55;
      const a = Math.random() * Math.PI * 2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } while ((Math.abs(x) < 20 && z < 0) || (Math.abs(x) < 152 && Math.abs(z) < 152)); // not on the pad square or road
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
