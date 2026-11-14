import * as THREE from 'three';
import { createEarth, createStarfield } from './space.js';
import { R_EARTH } from '../physics/orbits.js';

// Full-size Earth drawn as a background layer in kilometres (1 unit = 1 km), so altitude reads
// true: from the pad the Earth is flat, at 400 km the horizon curves, and the "map view" during
// time warp shows the whole planet with your orbit. The main scene (metres) is drawn on top.

const R = R_EARTH / 1000; // 6371 km

export function createEarthLayer() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200000);
  const earth = createEarth(R);
  scene.add(earth);
  const stars = createStarfield(5000, 150000);
  scene.add(stars);

  // Orbit rings for the map view: parking orbit (400 km), AURORA-7 (700 km).
  const ring = (alt, color, dashed) => {
    const pts = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * (R + alt), 0, Math.sin(a) * (R + alt)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 200, gapSize: 160, transparent: true })
      : new THREE.LineBasicMaterial({ color, transparent: true });
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    return line;
  };
  const orbits = new THREE.Group();
  orbits.add(ring(400, 0x8a97ad, true), ring(700, 0x4fc3f7, false));
  // Ship and satellite markers.
  const dot = (color) => new THREE.Mesh(new THREE.SphereGeometry(90, 12, 8), new THREE.MeshBasicMaterial({ color }));
  const shipDot = dot(0xffcc66);
  const satDot = dot(0x4fc3f7);
  orbits.add(shipDot, satDot);
  orbits.rotation.set(0.35, 0, 0.15); // tilted orbit plane reads better
  orbits.visible = false;
  scene.add(orbits);

  const up = new THREE.Vector3();
  return {
    scene,
    camera,
    earth,
    orbits,
    /** Ride along with the main camera at `altKm` above the surface (same look direction). */
    follow(mainCamera, altKm) {
      camera.fov = mainCamera.fov;
      camera.aspect = mainCamera.aspect;
      camera.near = Math.max(0.02, altKm * 0.05);
      camera.updateProjectionMatrix();
      camera.position.set(0, R + altKm, 0);
      camera.quaternion.copy(mainCamera.quaternion);
      stars.position.copy(camera.position);
      orbits.visible = false;
    },
    /**
     * Map view: look at the whole Earth from `distKm` away, with the orbits drawn.
     * `shipAngle` / `satAngle` place the markers (radians along their orbits).
     */
    mapView(distKm, aspect, shipAngle, satAngle, shipAlt = 400) {
      camera.fov = 45;
      camera.aspect = aspect;
      camera.near = 10;
      camera.updateProjectionMatrix();
      up.set(0.25, 0.75, 0.6).normalize();
      camera.position.copy(up).multiplyScalar(R + distKm);
      camera.lookAt(0, 0, 0);
      stars.position.copy(camera.position);
      orbits.visible = true;
      shipDot.position.set(Math.cos(shipAngle) * (R + shipAlt), 0, Math.sin(shipAngle) * (R + shipAlt));
      satDot.position.set(Math.cos(satAngle) * (R + 700), 0, Math.sin(satAngle) * (R + 700));
      const s = Math.max(1, distKm / 8000); // markers stay visible when far away
      shipDot.scale.setScalar(s);
      satDot.scale.setScalar(s);
    },
    tick(dt) {
      earth.userData.tick(dt);
    },
    /** Draw Earth layer, then the main scene on top (main scene must have no background). */
    render(renderer, mainScene, mainCamera) {
      renderer.autoClear = false;
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(mainScene, mainCamera);
      renderer.autoClear = true;
    },
  };
}
