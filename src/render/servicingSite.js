import * as THREE from 'three';
import { parts } from '../data/catalog.js';
import { buildRocket, setSolarDeploy } from './rocketMesh.js';
import { createAurora } from './aurora.js';
import { getModel } from './models.js';

// The servicing scene shared by the robotic-arm station and the spacewalk: damaged AURORA-7, the
// crew section holding position ~5 m off its broken side, the arm on the cargo module, the new
// panel strapped to the hull, and the three damage spots (only the broken array is obvious).

export const DAMAGE = {
  array: { name: 'Shattered solar array', text: 'The +X array is gone: only a cracked stub is left on the hinge. Needs the new panel.', fix: 'Fit the new panel on the mount' },
  cable: { name: 'Cut power harness', text: 'The fragment sliced the cable that carries power from the array into the satellite. A new panel alone would give no power.', fix: 'Splice the cut power cable' },
  radiator: { name: 'Dented radiator', text: 'Debris dented the radiator that dumps the instruments\' heat. Without a patch they overheat and run at half rate.', fix: 'Patch the dented radiator' },
};

/** Ship section without engines (everything above the first engine stage). */
export function crewSection(design) {
  const firstEngine = design.stack.findIndex((e) => e.engines || e.inside?.some((c) => c.engines) || /^tank/.test(e.part));
  return { stack: design.stack.slice(0, firstEngine > 0 ? firstEngine : design.stack.length), cargo: [] };
}

/** Simple arm with the GLB's joint names, used only if robotic-arm.glb isn't loaded. */
function primitiveArm() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.5, metalness: 0.5 });
  const node = (name, parent, x = 0, z = 0) => { const o = new THREE.Group(); o.name = name; o.position.set(x, 0, z); parent.add(o); return o; };
  const root = new THREE.Group();
  root.name = 'robotic-arm';
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.6).translate(0.05, 0, 0), dark));
  const base = node('base', root, 0.28);
  base.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 16), dark));
  const shoulder = node('shoulder', base, 0.32);
  shoulder.rotation.z = -Math.PI / 2;
  const upper = node('upper_boom', shoulder);
  upper.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.2, 12).rotateZ(Math.PI / 2).translate(1.6, 0, 0), mat));
  const elbow = node('elbow', upper, 3.2);
  elbow.rotation.z = Math.PI;
  const lower = node('lower_boom', elbow);
  lower.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 12).rotateZ(Math.PI / 2).translate(1.6, 0, 0.45), mat));
  const wp = node('wrist_pitch', lower, 3.2, 0.45);
  const wr = node('wrist_roll', wp, 0.13);
  const grab = node('grabber', wr, 0.2);
  grab.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.2, 12).rotateZ(Math.PI / 2), dark));
  for (let k = 0; k < 3; k++) {
    const jaw = node(`jaw_${k + 1}`, grab, 0.13);
    jaw.rotation.x = (k / 3) * Math.PI * 2;
    jaw.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04).translate(0.15, 0.1, 0), dark));
  }
  node('cam_wrist', grab, 0.11).position.y = 0.17;
  node('grip_point', grab, 0.36);
  return root;
}

export function createServicingSite(scene, design) {
  // AURORA-7, damaged.
  const aurora = createAurora();
  aurora.setBroken(true);
  scene.add(aurora.group);
  scene.updateMatrixWorld(true);
  const satBox = new THREE.Box3().setFromObject(aurora.group);
  const satCentre = satBox.getCenter(new THREE.Vector3());
  const satSize = satBox.getSize(new THREE.Vector3());
  const hinge = new THREE.Vector3();
  if (aurora.wingToShatter) aurora.wingToShatter.getWorldPosition(hinge);
  else hinge.set(satCentre.x + 1.2, satCentre.y, satCentre.z);

  // Broken stub left on the hinge.
  const stub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 1.3), new THREE.MeshStandardMaterial({ color: 0x1b3a8a, roughness: 0.4, metalness: 0.4 }));
  stub.position.copy(hinge).add(new THREE.Vector3(0.9, 0.3, 0));
  stub.rotation.set(0.5, 0.3, -0.4);
  scene.add(stub);

  // ---- damage you only see up close ----
  // Cut harness: an orange cable running down the bus side from the hinge, with a gap and frayed ends.
  const cableSpot = hinge.clone().add(new THREE.Vector3(-0.05, -0.75, 0.35));
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.6 });
  const cable = new THREE.Group();
  for (const [y0, y1] of [[0.6, 0.12], [-0.12, -0.7]]) {
    const piece = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, y0 - y1, 8), cableMat);
    piece.position.y = (y0 + y1) / 2;
    cable.add(piece);
  }
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff1a0 }));
  cable.add(spark);
  cable.position.copy(cableSpot);
  scene.add(cable);
  // Dented radiator: a scorched, crumpled patch on the radiator facing the ship (+Z).
  const radiatorObj = aurora.group.getObjectByName('radiator-px');
  const radBox = radiatorObj ? new THREE.Box3().setFromObject(radiatorObj) : null;
  const radiatorSpot = radBox
    ? new THREE.Vector3((radBox.min.x + radBox.max.x) / 2 - 0.3, (radBox.min.y + radBox.max.y) / 2 - 0.4, radBox.max.z + 0.02)
    : new THREE.Vector3(satCentre.x - 0.3, satCentre.y - 0.4, satCentre.z + satSize.z / 2 - 0.2);
  const dent = new THREE.Mesh(new THREE.CircleGeometry(0.32, 9), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  dent.position.copy(radiatorSpot);
  dent.scale.set(1, 0.7, 1);
  dent.rotation.z = 0.4;
  scene.add(dent);
  const damage = { array: hinge.clone().add(new THREE.Vector3(0.4, 0.2, 0.2)), cable: cableSpot, radiator: radiatorSpot };

  // ---- the ship: crew section ~5 m off the broken side, hatch and cargo module facing the satellite ----
  const shipDesign = crewSection(design);
  const ship = buildRocket(shipDesign, parts).group;
  setSolarDeploy(ship, 1);
  ship.rotation.y = Math.PI / 2; // part-space +X (hatch, cargo door, arm) now faces −Z, towards AURORA-7
  const cargoIdx = shipDesign.stack.findIndex((e) => /cargo-module/.test(e.part));
  const capIdx = shipDesign.stack.findIndex((e) => e.part === 'capsule-2');
  const cargoObj = ship.children.find((o) => o.userData.index === cargoIdx);
  const capsule = ship.children.find((o) => o.userData.index === capIdx);
  const cargoH = cargoIdx >= 0 ? parts.get(shipDesign.stack[cargoIdx].part).height : 3;
  const armLocal = new THREE.Vector3(1.25, (cargoObj?.position.y ?? 0) + cargoH * 0.75, 0);
  ship.position.set(hinge.x - 0.6, hinge.y - armLocal.y + 0.6, Math.max(hinge.z + 6.2, satCentre.z + satSize.z / 2 + 4.2));
  scene.add(ship);
  scene.updateMatrixWorld(true);

  // ---- the robotic arm, bolted to the cargo module ----
  const armModel = getModel('robotic-arm') ?? primitiveArm();
  const armMount = new THREE.Group();
  armMount.position.copy(armLocal);
  armMount.add(armModel);
  ship.add(armMount);

  // ---- the new panel, strapped to the cargo module beside the arm ----
  const panel = getModel('replacement-panel') ?? new THREE.Mesh(new THREE.BoxGeometry(0.29, 1, 1.5).translate(0.145, 0, 0), new THREE.MeshStandardMaterial({ color: 0x1b3a8a }));
  const panelHolder = new THREE.Group();
  const a = 0.75; // radians round the hull from the arm
  panelHolder.position.set(Math.cos(a) * 1.27, armLocal.y - 1.0, Math.sin(a) * 1.27);
  panelHolder.rotation.y = -a;
  panelHolder.add(panel);
  ship.add(panelHolder);
  scene.updateMatrixWorld(true);

  const hatch = capsule ? capsule.localToWorld(new THREE.Vector3(1.6, 1.4, 0)) : ship.position.clone();
  // Where the arm parks the panel for the spacewalker: just off the mount, on the ship's side.
  const parkSpot = hinge.clone().add(new THREE.Vector3(0.9, -1.1, 1.3));
  const dataSpot = satCentre.clone().add(new THREE.Vector3(0, 0.6, satSize.z / 2 + 0.25));

  return {
    aurora, satCentre, satSize, hinge, stub, ship, capsule, cargoObj, hatch,
    arm: armModel, armMount, panel, panelHolder, parkSpot, dataSpot, damage, cable, spark, dent,
    /** Panel to its parked spot (for the spacewalk when the arm already moved it). */
    parkPanel() {
      scene.attach(panel);
      panel.position.copy(parkSpot);
      panel.quaternion.copy(ship.quaternion);
    },
  };
}
