import * as THREE from 'three';

// Shared space visuals: starfield, procedural Earth / Moon, lighting.
// Procedural shaders until NASA Blue Marble textures are added (CLAUDE.md §11 #5).

export const SUN_DIR = new THREE.Vector3(-0.6, 0.35, 0.72).normalize();

/** Sun + faint fill light. */
export function addSpaceLighting(scene) {
  const sun = new THREE.DirectionalLight(0xfff4e0, 3);
  sun.position.copy(SUN_DIR).multiplyScalar(1000);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x334466, 0.35));
  return sun;
}

/** Stars on a big sphere. Call `stars.position.copy(camera.position)` each frame so they never get closer. */
export function createStarfield(count = 5000, radius = 6000) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(radius);
    pos.set([v.x, v.y, v.z], i * 3);
    // Mostly white, a few blue and orange stars.
    c.setHSL(Math.random() < 0.5 ? 0.6 : 0.08, Math.random() * 0.4, 0.55 + Math.random() * 0.45);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, fog: false });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  return stars;
}

// 3D value noise + fBm, shared by the planet shaders.
const NOISE = /* glsl */ `
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

const PLANET_VERT = /* glsl */ `
varying vec3 vObj; varying vec3 vN; varying vec3 vPos;
void main() {
  vObj = normal;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const EARTH_FRAG = /* glsl */ `
uniform vec3 sunDir; uniform float time;
varying vec3 vObj; varying vec3 vN; varying vec3 vPos;
${NOISE}
void main() {
  vec3 p = normalize(vObj);
  float n = fbm(p * 2.4 + 3.0);
  float land = smoothstep(0.53, 0.56, n);
  float ice = smoothstep(0.80, 0.9, abs(p.y) + (n - 0.5) * 0.3);
  vec3 ocean = mix(vec3(0.01, 0.06, 0.20), vec3(0.03, 0.18, 0.38), smoothstep(0.35, 0.53, n));
  float dry = fbm(p * 6.0);
  vec3 ground = mix(vec3(0.10, 0.28, 0.08), vec3(0.45, 0.36, 0.20), smoothstep(0.45, 0.65, dry));
  vec3 col = mix(ocean, ground, land);
  col = mix(col, vec3(0.92), ice);
  // Clouds drift slowly.
  float cl = smoothstep(0.52, 0.78, fbm(p * 3.5 + vec3(time * 0.004, 0.0, 0.0)));
  col = mix(col, vec3(1.0), cl * 0.85);

  vec3 N = normalize(vN);
  float diff = dot(N, sunDir);
  float lit = smoothstep(-0.15, 0.35, diff);
  vec3 V = normalize(cameraPosition - vPos);
  float spec = pow(max(dot(reflect(-sunDir, N), V), 0.0), 40.0) * (1.0 - land) * (1.0 - cl) * 0.6;
  // City lights on the night side.
  float city = land * (1.0 - ice) * smoothstep(0.62, 0.7, fbm(p * 18.0)) * (1.0 - lit);
  vec3 outCol = col * (0.03 + lit * 1.05) + spec + vec3(1.0, 0.75, 0.4) * city * 0.6;
  // Thin blue rim (atmosphere seen edge-on).
  float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  outCol += vec3(0.3, 0.55, 1.0) * rim * smoothstep(-0.3, 0.4, diff) * 0.8;
  gl_FragColor = vec4(outCol, 1.0);
}`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 sunDir; varying vec3 vObj; varying vec3 vN; varying vec3 vPos;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vPos);
  float edge = pow(clamp(1.0 + dot(N, V) * 1.0, 0.0, 1.0), 4.0);
  float day = smoothstep(-0.4, 0.5, dot(N, sunDir));
  gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * edge * day * 1.4, 1.0);
}`;

const MOON_FRAG = /* glsl */ `
uniform vec3 sunDir; varying vec3 vObj; varying vec3 vN; varying vec3 vPos;
${NOISE}
void main() {
  vec3 p = normalize(vObj);
  float n = fbm(p * 3.0);
  float maria = smoothstep(0.45, 0.6, fbm(p * 1.5 + 7.0));
  float craters = smoothstep(0.6, 0.75, fbm(p * 14.0));
  vec3 col = mix(vec3(0.62), vec3(0.32), maria) * (0.8 + n * 0.4) - craters * 0.08;
  float lit = smoothstep(-0.05, 0.3, dot(normalize(vN), sunDir));
  gl_FragColor = vec4(col * (0.02 + lit), 1.0);
}`;

/** Procedural Earth with clouds, night lights and an atmosphere halo. */
export function createEarth(radius) {
  const uniforms = { sunDir: { value: SUN_DIR.clone() }, time: { value: 0 } };
  const group = new THREE.Group();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 64),
    new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VERT, fragmentShader: EARTH_FRAG }),
  );
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.025, 96, 64),
    new THREE.ShaderMaterial({
      uniforms, vertexShader: PLANET_VERT, fragmentShader: ATMO_FRAG,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  group.add(earth, atmo);
  // Scenes look down from above, so tip the poles sideways: we see oceans and land, not ice caps.
  group.rotation.set(0.3, 0, 1.25);
  group.userData.tick = (dt) => {
    uniforms.time.value += dt;
    earth.rotation.y += dt * 0.004;
  };
  return group;
}

export function createMoon(radius) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 48),
    new THREE.ShaderMaterial({ uniforms: { sunDir: { value: SUN_DIR.clone() } }, vertexShader: PLANET_VERT, fragmentShader: MOON_FRAG }),
  );
}

/** Dust points spread along a path; they stream past the camera during the long mission-select flights. */
export function createSpeedDust(from, to, count = 4000, spread = 260) {
  const pos = new Float32Array(count * 3);
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  for (let i = 0; i < count; i++) {
    const p = a.clone().lerp(b, Math.random());
    const r = 30 + Math.random() * spread;
    const ang = Math.random() * Math.PI * 2;
    p.x += Math.cos(ang) * r;
    p.y += Math.sin(ang) * r;
    pos.set([p.x, p.y, p.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9fc4ff, size: 1.2, transparent: true, opacity: 0, depthWrite: false }));
}
