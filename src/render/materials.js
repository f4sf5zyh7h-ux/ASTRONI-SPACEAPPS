import * as THREE from 'three';

// One shared material per look, reused by every part mesh (CLAUDE.md §2 performance).
const std = (color, roughness = 0.6, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

export const MAT = {
  hull: std(0xe8edf2),
  capsule: std(0xcfd6de, 0.5),
  metal: std(0x2b313a, 0.4, 0.6),
  bell: std(0x3a3f47, 0.35, 0.8),
  heatShield: std(0x5a3a22, 0.9),
  chute: std(0xe07a2f, 0.8),
  decoupler: std(0xf2a33a, 0.5, 0.2),
  solar: std(0x1b3a8a, 0.3, 0.5),
  fin: std(0xb0b8c4, 0.5, 0.3),
  gold: std(0xc9a227, 0.4, 0.7),
  shield: std(0x8d99a8, 0.7, 0.4),
  srb: std(0xf0f0f0, 0.6),
  locked: new THREE.MeshStandardMaterial({ color: 0x555b66, roughness: 0.9, transparent: true, opacity: 0.45 }),
};
