import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  DRESSING,
  EQUIPMENT,
  FENCE,
  RACK,
  SITE,
  TANKS,
  TOWERS,
  TRUCK,
  anchorWorld,
  assetById,
  assetOrigin,
  floorY,
  type AssetKind,
} from '../sim/plant.ts';
import type { Vec3 } from '../sim/types.ts';
import { createMetal, nameplateTexture, type SurfaceMaterials } from './materials.ts';

const UP = new Vector3(0, 1, 0);
const scratchDir = new Vector3();
const scratchMid = new Vector3();
const scratchQuat = new Quaternion();
const scratchMatrix = new Matrix4();
const scratchScale = new Vector3(1, 1, 1);

function merge(parts: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(parts, false);
  if (!geometry) throw new Error('几何合并失败');
  for (const part of parts) part.dispose();
  return geometry;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

function cylY(radius: number, height: number, x: number, y: number, z: number, segments = 20): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius, height, segments);
  geometry.translate(x, y, z);
  return geometry;
}

function cylX(radius: number, length: number, x: number, y: number, z: number, segments = 16): BufferGeometry {
  const geometry = new CylinderGeometry(radius, radius, length, segments);
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(x, y, z);
  return geometry;
}

export function beamBetween(a: Vec3, b: Vec3, thickness: number, depth = thickness): BufferGeometry {
  scratchDir.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const length = Math.max(0.02, scratchDir.length());
  const geometry = new BoxGeometry(thickness, length, depth);
  scratchMid.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  scratchQuat.setFromUnitVectors(UP, scratchDir.multiplyScalar(1 / length));
  scratchMatrix.compose(scratchMid, scratchQuat, scratchScale);
  geometry.applyMatrix4(scratchMatrix);
  return geometry;
}

function tag(group: Group, id: string): Group {
  group.name = id;
  group.userData.assetId = id;
  group.traverse((object) => {
    object.userData.assetId = id;
    const mesh = object as Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return group;
}

function mesh(geometry: BufferGeometry, material: MeshStandardMaterial, assetId: string): Mesh {
  const item = new Mesh(geometry, material);
  item.userData.assetId = assetId;
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

function nozzle(local: Vec3, axis: 'x' | 'y'): BufferGeometry[] {
  const barrel = new CylinderGeometry(0.11, 0.11, 0.62, 10);
  const flange = new TorusGeometry(0.18, 0.035, 6, 14);
  if (axis === 'x') {
    barrel.rotateZ(Math.PI / 2);
    flange.rotateY(Math.PI / 2);
  } else {
    flange.rotateX(Math.PI / 2);
  }
  barrel.translate(local.x, local.y, local.z);
  flange.translate(local.x, local.y, local.z);
  return [barrel, flange];
}

function localAnchor(id: string, anchor: string): Vec3 {
  const origin = assetOrigin(id, 0);
  const world = anchorWorld(id, anchor, 0);
  return { x: world.x - origin.x, y: world.y - origin.y, z: world.z - origin.z };
}

function addPlate(group: Group, id: string, x: number, y: number, z: number, rotation: number): void {
  const asset = assetById(id);
  const material = new MeshStandardMaterial({
    map: nameplateTexture(id, asset.name),
    roughness: 0.6,
    metalness: 0.2,
  });
  const plate = new Mesh(new PlaneGeometry(1.8, 0.86), material);
  plate.position.set(x, y, z);
  plate.rotation.y = rotation;
  group.add(plate);
}

export function createTower(id: string): Group {
  const spec = TOWERS[id];
  const shellMat = createMetal(id === 'T-101' ? '#d5dde2' : '#c5ced4', id, 0.82, 0.28);
  const deckMat = createMetal('#8d97a0', id, 0.64, 0.42);
  const shell: BufferGeometry[] = [];
  const decks: BufferGeometry[] = [];
  const shellHeight = spec.h - spec.r * 0.55;
  shell.push(cylY(spec.r * 1.08, 1.15, 0, 0.58, 0, 24));
  shell.push(cylY(spec.r, shellHeight - 1.2, 0, 1.2 + (shellHeight - 1.2) / 2, 0, 28));
  const head = new SphereGeometry(spec.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  head.translate(0, shellHeight, 0);
  shell.push(head);
  shell.push(box(spec.r * 2.5, 0.18, spec.r * 2.5, 0, 0.1, 0));
  for (let y = 2.2; y < shellHeight - 0.4; y += 1.45) {
    const ring = new TorusGeometry(spec.r + 0.045, 0.045, 6, 22);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, y, 0);
    shell.push(ring);
  }
  const levels = [5.2, 13, 21.5, 26, 34].filter((y) => y < spec.h - 3.2);
  for (const y of levels) {
    const deck = new RingGeometry(spec.r + 0.04, spec.r + 1.15, 28);
    deck.rotateX(-Math.PI / 2);
    deck.translate(0, y, 0);
    decks.push(deck);
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2;
      const px = Math.cos(angle) * (spec.r + 1.05);
      const pz = Math.sin(angle) * (spec.r + 1.05);
      decks.push(box(0.05, 0.85, 0.05, px, y + 0.45, pz));
    }
    decks.push(new TorusGeometry(spec.r + 1.05, 0.035, 5, 24).rotateX(Math.PI / 2).translate(0, y + 0.85, 0));
  }
  const ladderX = 0;
  const ladderZ = spec.r + 0.38;
  shell.push(beamBetween({ x: ladderX - 0.16, y: 0.3, z: ladderZ }, { x: ladderX - 0.16, y: spec.h - 1.2, z: ladderZ }, 0.05));
  shell.push(beamBetween({ x: ladderX + 0.16, y: 0.3, z: ladderZ }, { x: ladderX + 0.16, y: spec.h - 1.2, z: ladderZ }, 0.05));
  for (let y = 0.5; y < spec.h - 1.4; y += 0.38) {
    shell.push(box(0.34, 0.03, 0.04, ladderX, y, ladderZ));
    if (y > 2.4 && Math.round(y * 10) % 12 === 0) {
      const hoop = new TorusGeometry(0.34, 0.02, 5, 12);
      hoop.rotateX(Math.PI / 2);
      hoop.translate(ladderX, y, ladderZ - 0.02);
      shell.push(hoop);
    }
  }
  for (const anchor of ['feed', 'overhead', 'bottoms', 'reflux']) {
    const local = localAnchor(id, anchor);
    const axis = anchor === 'overhead' ? 'y' : 'x';
    shell.push(...nozzle(local, axis));
  }
  const group = new Group();
  group.add(mesh(merge(shell), shellMat, id));
  if (decks.length) group.add(mesh(merge(decks), deckMat, id));
  addPlate(group, id, -spec.r * 0.15, 2.4, spec.r + 0.08, 0.55);
  const origin = assetOrigin(id, 0);
  group.position.set(origin.x, origin.y, origin.z);
  return tag(group, id);
}

export function createTank(id: string): Group {
  const spec = TANKS[id];
  const material = createMetal(id === 'TK-201' ? '#c5d0c2' : '#b7c4bc', id, 0.74, 0.32);
  const parts: BufferGeometry[] = [];
  parts.push(cylY(spec.r, spec.h, 0, spec.h / 2, 0, 32));
  const dome = new SphereGeometry(spec.r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(1, 0.38, 1);
  dome.translate(0, spec.h, 0);
  parts.push(dome);
  parts.push(cylY(spec.r + 0.08, 0.22, 0, 0.16, 0, 28));
  for (let y = 2; y < spec.h - 0.4; y += 2.1) {
    const weld = new TorusGeometry(spec.r + 0.03, 0.035, 5, 28);
    weld.rotateX(Math.PI / 2);
    weld.translate(0, y, 0);
    parts.push(weld);
  }
  const girder = new TorusGeometry(spec.r + 0.12, 0.07, 6, 28);
  girder.rotateX(Math.PI / 2);
  girder.translate(0, spec.h * 0.72, 0);
  parts.push(girder);
  const deck = new RingGeometry(spec.r * 0.15, spec.r + 0.45, 28);
  deck.rotateX(-Math.PI / 2);
  deck.translate(0, spec.h + 0.05, 0);
  parts.push(deck);
  parts.push(new TorusGeometry(spec.r + 0.4, 0.04, 5, 24).rotateX(Math.PI / 2).translate(0, spec.h + 0.85, 0));
  const steps = 18;
  let previous: Vec3 | null = null;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    const angle = -0.4 + t * Math.PI * 1.15;
    const point = {
      x: Math.cos(angle) * (spec.r + 0.48),
      y: 0.35 + t * (spec.h - 0.6),
      z: Math.sin(angle) * (spec.r + 0.48),
    };
    parts.push(box(0.72, 0.07, 0.28, point.x, point.y, point.z));
    if (previous) parts.push(beamBetween(previous, point, 0.04));
    previous = { x: point.x, y: point.y + 0.85, z: point.z };
  }
  parts.push(...nozzle(localAnchor(id, 'outlet'), 'x'));
  parts.push(...nozzle(localAnchor(id, 'inlet'), 'x'));
  const group = new Group();
  group.add(mesh(merge(parts), material, id));
  addPlate(group, id, -spec.r - 0.05, 3.1, 0.2, -Math.PI / 2);
  const origin = assetOrigin(id, 0);
  group.position.set(origin.x, origin.y, origin.z);
  return tag(group, id);
}

export function createPump(): Group {
  const id = 'P-401';
  const material = createMetal('#b7c3c8', id, 0.7, 0.38);
  const motor = createMetal('#4d575d', id, 0.5, 0.48);
  const parts: BufferGeometry[] = [
    box(2.5, 0.16, 1.15, 0, 0.1, 0),
    cylX(0.34, 1.15, -0.15, 0.62, 0, 18),
    box(0.18, 0.18, 0.18, 0.55, 0.55, 0),
  ];
  const volute = new SphereGeometry(0.42, 18, 14);
  volute.translate(0.95, 0.62, 0);
  parts.push(volute);
  parts.push(...nozzle(localAnchor(id, 'suction'), 'x'));
  parts.push(...nozzle(localAnchor(id, 'discharge'), 'x'));
  const group = new Group();
  group.add(mesh(merge(parts), material, id));
  group.add(mesh(cylX(0.28, 0.7, -0.55, 0.64, 0, 16), motor, id));
  addPlate(group, id, 0, 1.15, 0.62, 0);
  const origin = assetOrigin(id, 0);
  group.position.set(origin.x, origin.y, origin.z);
  return tag(group, id);
}

export function createExchanger(): Group {
  const id = 'E-101';
  const spec = EQUIPMENT.exchanger;
  const material = createMetal('#d0d6da', id, 0.75, 0.3);
  const half = spec.length / 2;
  const parts: BufferGeometry[] = [
    cylX(spec.radius, spec.length, 0, 0, 0, 22),
    box(0.7, 0.16, 0.7, -1.7, -spec.radius - 0.15, 0),
    box(0.7, 0.16, 0.7, 1.7, -spec.radius - 0.15, 0),
  ];
  const headA = new SphereGeometry(spec.radius, 18, 12);
  headA.scale(0.45, 1, 1);
  headA.translate(-half, 0, 0);
  const headB = headA.clone().translate(spec.length, 0, 0);
  parts.push(headA, headB);
  for (let x = -half + 0.6; x < half; x += 0.85) {
    const band = new TorusGeometry(spec.radius + 0.02, 0.03, 5, 16);
    band.rotateY(Math.PI / 2);
    band.translate(x, 0, 0);
    parts.push(band);
  }
  parts.push(...nozzle(localAnchor(id, 'inlet'), 'x'));
  parts.push(...nozzle(localAnchor(id, 'outlet'), 'x'));
  const group = new Group();
  group.add(mesh(merge(parts), material, id));
  addPlate(group, id, 0, spec.radius + 0.55, 0, 0);
  const origin = assetOrigin(id, 0);
  group.position.set(origin.x, origin.y, origin.z);
  return tag(group, id);
}

export function createDrum(): Group {
  const id = 'V-301';
  const spec = EQUIPMENT.drum;
  const material = createMetal('#d8dee2', id, 0.76, 0.3);
  const half = spec.length / 2;
  const parts: BufferGeometry[] = [
    cylX(spec.radius, spec.length, 0, 0, 0, 24),
    box(0.8, 0.55, 0.7, -1.4, -spec.radius - 0.2, 0),
    box(0.8, 0.55, 0.7, 1.4, -spec.radius - 0.2, 0),
  ];
  const head = new SphereGeometry(spec.radius, 18, 12);
  head.scale(0.5, 1, 1);
  head.translate(-half, 0, 0);
  parts.push(head, head.clone().translate(spec.length, 0, 0));
  parts.push(...nozzle(localAnchor(id, 'inlet'), 'x'));
  parts.push(...nozzle({ ...localAnchor(id, 'reflux') }, 'x'));
  const group = new Group();
  group.add(mesh(merge(parts), material, id));
  addPlate(group, id, 0, spec.radius + 0.5, spec.radius + 0.02, 0);
  const origin = assetOrigin(id, 0);
  group.position.set(origin.x, origin.y, origin.z);
  return tag(group, id);
}

export function createCooler(): { group: Group; fans: Object3D[] } {
  const id = 'CW-301';
  const material = createMetal('#667178', id, 0.62, 0.4);
  const frame: BufferGeometry[] = [
    box(10.6, 0.18, 3.4, 0, 2.15, 0),
    box(10.8, 0.7, 0.35, 0, 1.55, -1.5),
    box(0.2, 2.2, 0.2, -5, 1.1, -1.4),
    box(0.2, 2.2, 0.2, 5, 1.1, -1.4),
    box(0.2, 2.2, 0.2, -5, 1.1, 1.4),
    box(0.2, 2.2, 0.2, 5, 1.1, 1.4),
  ];
  frame.push(...nozzle(localAnchor(id, 'processIn'), 'x'));
  frame.push(...nozzle(localAnchor(id, 'processOut'), 'x'));
  frame.push(...nozzle(localAnchor(id, 'waterIn'), 'y'));
  const group = new Group();
  group.add(mesh(merge(frame), material, id));
  const fans: Object3D[] = [];
  for (const x of [-3.6, -1.2, 1.2, 3.6]) {
    const shroud = new Mesh(new CylinderGeometry(1.15, 1.15, 0.42, 24, 1, true), material);
    shroud.position.set(x, 2.45, 0);
    group.add(shroud);
    const pivot = new Object3D();
    pivot.position.set(x, 2.45, 0);
    pivot.userData.role = 'fan';
    for (let blade = 0; blade < 4; blade += 1) {
      const holder = new Object3D();
      holder.rotation.y = (blade / 4) * Math.PI * 2;
      const shape = new Mesh(new BoxGeometry(0.16, 0.05, 0.95), material);
      shape.position.set(0, 0, 0.55);
      holder.add(shape);
      pivot.add(holder);
    }
    const hub = new Mesh(new CylinderGeometry(0.18, 0.18, 0.16, 12), material);
    pivot.add(hub);
    group.add(pivot);
    fans.push(pivot);
  }
  addPlate(group, id, 0, 3.3, 1.8, 0);
  const origin = assetOrigin(id, 0);
  group.position.set(origin.x, origin.y, origin.z);
  return { group: tag(group, id), fans };
}

export function createBasin(waterMaterial: Mesh['material']): { group: Group; water: Mesh } {
  const id = 'CW-302';
  const spec = EQUIPMENT.basin;
  const material = createMetal('#8b948f', id, 0.2, 0.78);
  const wall = 0.35;
  const h = 1.15;
  const parts = [
    box(spec.w, h, wall, 0, h / 2, spec.d / 2 - wall / 2),
    box(spec.w, h, wall, 0, h / 2, -spec.d / 2 + wall / 2),
    box(wall, h, spec.d, spec.w / 2 - wall / 2, h / 2, 0),
    box(wall, h, spec.d, -spec.w / 2 + wall / 2, h / 2, 0),
    box(spec.w, 0.18, spec.d, 0, 0.08, 0),
  ];
  const group = new Group();
  group.add(mesh(merge(parts), material, id));
  const water = new Mesh(new PlaneGeometry(spec.w - 1.1, spec.d - 1.1), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.42;
  water.userData.assetId = id;
  water.receiveShadow = true;
  water.name = 'basin-water';
  group.add(water);
  addPlate(group, id, 0, 1.8, spec.d / 2 + 0.05, 0);
  const origin = assetOrigin(id, 0);
  group.position.set(origin.x, origin.y, origin.z);
  return { group: tag(group, id), water };
}

export function createRack(gap: number, surfaces: SurfaceMaterials): Group {
  const id = 'PR-401';
  const y1 = floorY(1, gap);
  const y2 = floorY(2, gap);
  const levels = [6.4, y1, y2];
  const xs: number[] = [];
  const zs: number[] = [];
  for (let x = RACK.x0; x <= RACK.x1 + 0.01; x += (RACK.x1 - RACK.x0) / 6) xs.push(x);
  for (let z = RACK.z0; z <= RACK.z1 + 0.01; z += (RACK.z1 - RACK.z0) / 4) zs.push(z);
  const steel: BufferGeometry[] = [];
  const gratings: BufferGeometry[] = [];
  for (const x of xs) {
    for (const z of zs) steel.push(box(0.28, y2, 0.28, x, y2 / 2, z));
  }
  for (const y of levels) {
    for (const z of zs) steel.push(box(RACK.x1 - RACK.x0, 0.22, 0.18, (RACK.x0 + RACK.x1) / 2, y, z));
    for (const x of xs) steel.push(box(0.18, 0.22, RACK.z1 - RACK.z0, x, y + 0.18, (RACK.z0 + RACK.z1) / 2));
    const grate = new PlaneGeometry(RACK.x1 - RACK.x0 - 0.4, RACK.z1 - RACK.z0 - 0.4);
    grate.rotateX(-Math.PI / 2);
    grate.translate((RACK.x0 + RACK.x1) / 2, y + 0.12, (RACK.z0 + RACK.z1) / 2);
    gratings.push(grate);
    const yRail = y + 1.05;
    steel.push(box(RACK.x1 - RACK.x0, 0.06, 0.05, (RACK.x0 + RACK.x1) / 2, yRail, RACK.z0));
    steel.push(box(RACK.x1 - RACK.x0, 0.06, 0.05, (RACK.x0 + RACK.x1) / 2, yRail, RACK.z1));
    steel.push(box(0.05, 0.06, RACK.z1 - RACK.z0, RACK.x0, yRail, (RACK.z0 + RACK.z1) / 2));
    steel.push(box(0.05, 0.06, RACK.z1 - RACK.z0, RACK.x1, yRail, (RACK.z0 + RACK.z1) / 2));
    for (let x = RACK.x0; x <= RACK.x1; x += 2.4) {
      steel.push(box(0.04, 0.9, 0.04, x, y + 0.55, RACK.z0));
      steel.push(box(0.04, 0.9, 0.04, x, y + 0.55, RACK.z1));
    }
  }
  steel.push(beamBetween({ x: RACK.x0, y: 0.4, z: RACK.z0 }, { x: xs[1], y: y1, z: RACK.z0 }, 0.12));
  steel.push(beamBetween({ x: RACK.x1, y: 0.4, z: RACK.z1 }, { x: xs[xs.length - 2], y: y1, z: RACK.z1 }, 0.12));
  steel.push(beamBetween({ x: RACK.x0, y: y1, z: RACK.z1 }, { x: xs[1], y: y2, z: RACK.z1 }, 0.12));
  const ladderX = RACK.x0 + 1.2;
  const ladderZ = RACK.z1 + 0.45;
  steel.push(beamBetween({ x: ladderX - 0.18, y: 0.2, z: ladderZ }, { x: ladderX - 0.18, y: y2, z: ladderZ }, 0.05));
  steel.push(beamBetween({ x: ladderX + 0.18, y: 0.2, z: ladderZ }, { x: ladderX + 0.18, y: y2, z: ladderZ }, 0.05));
  for (let y = 0.4; y < y2; y += 0.36) steel.push(box(0.38, 0.03, 0.04, ladderX, y, ladderZ));
  const pipeYs = [3.3, 8.6, y1 + 0.85, y1 + 2.3, y2 + 0.75];
  const pipeZs = [RACK.z0 + 3, 2, 8, RACK.z1 - 3];
  const staticPipes: BufferGeometry[] = [];
  for (const y of pipeYs) {
    for (const z of pipeZs) {
      staticPipes.push(cylX(0.09, RACK.x1 - RACK.x0 - 1.4, (RACK.x0 + RACK.x1) / 2, y, z, 10));
    }
  }
  const group = new Group();
  const steelMesh = mesh(merge(steel), surfaces.gold, id);
  steelMesh.userData.floor = 'columns';
  group.add(steelMesh);
  const grateMesh = mesh(merge(gratings), surfaces.grating, id);
  group.add(grateMesh);
  group.add(mesh(merge(staticPipes), surfaces.pipeSteel, id));
  group.userData.levels = { y0: 6.4, y1, y2 };
  return tag(group, id);
}

export function createSite(surfaces: SurfaceMaterials): Group {
  const group = new Group();
  group.name = 'site';
  const ground = new Mesh(new PlaneGeometry(SITE.width, SITE.depth), surfaces.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(SITE.centerX, -0.04, SITE.centerZ);
  ground.receiveShadow = true;
  group.add(ground);
  const pad = new Mesh(new BoxGeometry(74, 0.12, 72), surfaces.pad);
  pad.position.set(34, 0.02, 5);
  pad.receiveShadow = true;
  group.add(pad);

  const roadY = 0.03;
  const road = surfaces.road;
  const west = new Mesh(new BoxGeometry(7, 0.06, 78), road);
  west.position.set(FENCE.x0 - 6, roadY, (FENCE.z0 + FENCE.z1) / 2);
  const east = new Mesh(new BoxGeometry(7, 0.06, 78), road);
  east.position.set(FENCE.x1 + 6, roadY, (FENCE.z0 + FENCE.z1) / 2);
  const south = new Mesh(new BoxGeometry(86, 0.06, 7), road);
  south.position.set((FENCE.x0 + FENCE.x1) / 2, roadY, FENCE.z1 + 6);
  const north = new Mesh(new BoxGeometry(86, 0.06, 7), road);
  north.position.set((FENCE.x0 + FENCE.x1) / 2, roadY, FENCE.z0 - 6);
  for (const piece of [west, east, south, north]) {
    piece.receiveShadow = true;
    group.add(piece);
  }
  const dashes: BufferGeometry[] = [];
  for (let z = FENCE.z0; z < FENCE.z1; z += 4.5) {
    dashes.push(box(0.16, 0.02, 1.6, FENCE.x0 - 6, 0.08, z));
    dashes.push(box(0.16, 0.02, 1.6, FENCE.x1 + 6, 0.08, z));
  }
  for (let x = FENCE.x0; x < FENCE.x1; x += 4.5) {
    dashes.push(box(1.6, 0.02, 0.16, x, 0.08, FENCE.z1 + 6));
    dashes.push(box(1.6, 0.02, 0.16, x, 0.08, FENCE.z0 - 6));
  }
  const dash = new Mesh(merge(dashes), surfaces.mark);
  dash.receiveShadow = true;
  group.add(dash);

  const posts = new InstancedMesh(new CylinderGeometry(0.06, 0.07, 1.35, 6), surfaces.dark, 160);
  const dummy = new Object3D();
  let postIndex = 0;
  const placePost = (x: number, z: number) => {
    dummy.position.set(x, 0.68, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    posts.setMatrixAt(postIndex, dummy.matrix);
    postIndex += 1;
  };
  for (let x = FENCE.x0; x <= FENCE.x1; x += 3) {
    placePost(x, FENCE.z0);
    placePost(x, FENCE.z1);
  }
  for (let z = FENCE.z0 + 3; z < FENCE.z1; z += 3) {
    placePost(FENCE.x0, z);
    placePost(FENCE.x1, z);
  }
  posts.count = postIndex;
  posts.instanceMatrix.needsUpdate = true;
  posts.computeBoundingSphere();
  posts.castShadow = true;
  group.add(posts);
  const rails = [
    box(FENCE.x1 - FENCE.x0, 0.05, 0.04, (FENCE.x0 + FENCE.x1) / 2, 0.55, FENCE.z0),
    box(FENCE.x1 - FENCE.x0, 0.05, 0.04, (FENCE.x0 + FENCE.x1) / 2, 1.05, FENCE.z0),
    box(FENCE.x1 - FENCE.x0, 0.05, 0.04, (FENCE.x0 + FENCE.x1) / 2, 0.55, FENCE.z1),
    box(FENCE.x1 - FENCE.x0, 0.05, 0.04, (FENCE.x0 + FENCE.x1) / 2, 1.05, FENCE.z1),
    box(0.04, 0.05, FENCE.z1 - FENCE.z0, FENCE.x0, 0.55, (FENCE.z0 + FENCE.z1) / 2),
    box(0.04, 0.05, FENCE.z1 - FENCE.z0, FENCE.x0, 1.05, (FENCE.z0 + FENCE.z1) / 2),
    box(0.04, 0.05, FENCE.z1 - FENCE.z0, FENCE.x1, 0.55, (FENCE.z0 + FENCE.z1) / 2),
    box(0.04, 0.05, FENCE.z1 - FENCE.z0, FENCE.x1, 1.05, (FENCE.z0 + FENCE.z1) / 2),
  ];
  group.add(new Mesh(merge(rails), surfaces.dark));

  const street = DRESSING.filter((tree) => tree.kind === 'street');
  const trunks = new InstancedMesh(new CylinderGeometry(0.16, 0.22, 1.5, 6), surfaces.trunk, street.length);
  const crowns = new InstancedMesh(new SphereGeometry(1.15, 12, 10), surfaces.leaf, street.length);
  street.forEach((tree, index) => {
    dummy.position.set(tree.x, 1.1, tree.z);
    dummy.scale.setScalar(tree.scale * 1.8);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    dummy.position.set(tree.x, 3.6 * tree.scale, tree.z);
    dummy.scale.setScalar(tree.scale * 1.8);
    dummy.updateMatrix();
    crowns.setMatrixAt(index, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  trunks.computeBoundingSphere();
  crowns.computeBoundingSphere();
  trunks.castShadow = true;
  crowns.castShadow = true;
  trunks.userData.role = 'trees';
  crowns.userData.role = 'trees';
  group.add(trunks, crowns);

  group.add(createTruck());
  return group;
}

function createTruck(): Group {
  const group = new Group();
  const body = new Mesh(new BoxGeometry(1.7, 0.55, 4.4), new MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.45, metalness: 0.2 }));
  body.position.set(TRUCK.x, 0.7, TRUCK.z);
  const cab = new Mesh(new BoxGeometry(1.62, 0.7, 1.5), new MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.4, metalness: 0.18 }));
  cab.position.set(TRUCK.x, 1.15, TRUCK.z + 1.15);
  const glass = new Mesh(new BoxGeometry(1.5, 0.42, 0.08), new MeshStandardMaterial({ color: '#24343c', roughness: 0.15, metalness: 0.1 }));
  glass.position.set(TRUCK.x, 1.2, TRUCK.z + 1.92);
  group.add(body, cab, glass);
  const wheelMat = new MeshStandardMaterial({ color: '#1b1e22', roughness: 0.7 });
  for (const [x, z] of [[-0.78, 1.35], [0.78, 1.35], [-0.78, -1.25], [0.78, -1.25]] as const) {
    const wheel = new Mesh(new CylinderGeometry(0.32, 0.32, 0.22, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(TRUCK.x + x, 0.32, TRUCK.z + z);
    group.add(wheel);
  }
  group.traverse((object) => {
    const item = object as Mesh;
    if (item.isMesh) {
      item.castShadow = true;
      item.receiveShadow = true;
    }
  });
  return group;
}

export function createLamps(surfaces: SurfaceMaterials): { group: Group; heads: Mesh[] } {
  const group = new Group();
  const heads: Mesh[] = [];
  const spots = DRESSING.filter((item) => item.kind === 'street').filter((_, index) => index % 4 === 0);
  for (const spot of spots) {
    const pole = new Mesh(new CylinderGeometry(0.07, 0.1, 6.2, 8), surfaces.lamp);
    pole.position.set(spot.x, 3.1, spot.z);
    pole.castShadow = true;
    const head = new Mesh(new BoxGeometry(0.55, 0.12, 0.28), surfaces.lampHead);
    head.position.set(spot.x + 0.45, 6.15, spot.z);
    heads.push(head);
    group.add(pole, head);
  }
  return { group, heads };
}

export function assetKind(id: string): AssetKind {
  return assetById(id).kind;
}
