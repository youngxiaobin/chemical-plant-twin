import type { FloorIndex, LaneId, Vec3 } from './types.ts';
import { aisleRoute, directRoute, filletPolyline } from './route.ts';

export type AssetKind = 'tower' | 'tank' | 'pump' | 'exchanger' | 'drum' | 'cooler' | 'basin' | 'rack';

export interface AssetDef {
  id: string;
  name: string;
  group: string;
  kind: AssetKind;
  floors: FloorIndex[];
  /** Selection ring radius, meters. */
  radius: number;
  /** How this tag relates to the tutorial example chain. */
  tutorialAnalog: string;
  levelLabel: string;
}

export const ASSETS: AssetDef[] = [
  { id: 'T-101', name: '主精馏塔', group: '精馏塔组', kind: 'tower', floors: [0, 1, 2], radius: 3.4, tutorialAnalog: '教程 T-201', levelLabel: '塔釜液位' },
  { id: 'T-102', name: '汽提塔', group: '精馏塔组', kind: 'tower', floors: [0, 1, 2], radius: 3.1, tutorialAnalog: '教程 T-202', levelLabel: '塔釜液位' },
  { id: 'T-103', name: '吸收塔', group: '精馏塔组', kind: 'tower', floors: [0, 1, 2], radius: 2.9, tutorialAnalog: '定稿增补，无教程位号', levelLabel: '塔釜液位' },
  { id: 'T-104', name: '放空塔', group: '精馏塔组', kind: 'tower', floors: [0, 1, 2], radius: 2.7, tutorialAnalog: '定稿增补，无教程位号', levelLabel: '塔釜液位' },
  { id: 'TK-201', name: '原料罐', group: '储运罐区', kind: 'tank', floors: [0], radius: 6.4, tutorialAnalog: '教程 TK-101', levelLabel: '液位' },
  { id: 'TK-202', name: '中间罐', group: '储运罐区', kind: 'tank', floors: [0], radius: 6.1, tutorialAnalog: '教程 TK-102', levelLabel: '液位' },
  { id: 'E-101', name: '原料预热器', group: '换热与回流', kind: 'exchanger', floors: [0], radius: 4.2, tutorialAnalog: '教程 E-101', levelLabel: '管程负荷' },
  { id: 'V-301', name: '回流罐', group: '换热与回流', kind: 'drum', floors: [2], radius: 3.6, tutorialAnalog: '教程 V-301', levelLabel: '液位' },
  { id: 'CW-301', name: '轴流冷却机组', group: '冷却系统', kind: 'cooler', floors: [0], radius: 7.2, tutorialAnalog: '教程 E-301', levelLabel: '凝液负荷' },
  { id: 'CW-302', name: '冷却水池', group: '冷却系统', kind: 'basin', floors: [0], radius: 9, tutorialAnalog: '定稿公用工程，无教程位号', levelLabel: '水位' },
  { id: 'P-401', name: '进料泵', group: '管廊与机泵', kind: 'pump', floors: [0], radius: 2.1, tutorialAnalog: '教程 P-101', levelLabel: '运行负荷' },
  { id: 'PR-401', name: '三层管廊', group: '管廊与机泵', kind: 'rack', floors: [0, 1, 2], radius: 18, tutorialAnalog: '定稿结构，无教程位号', levelLabel: '层间负荷' },
];

export const ASSET_IDS = ASSETS.map((asset) => asset.id);

export function assetById(id: string): AssetDef {
  const found = ASSETS.find((asset) => asset.id === id);
  if (!found) throw new Error(`unknown asset ${id}`);
  return found;
}

export interface PipeDef {
  id: string;
  name: string;
  from: string;
  to: string;
  fromAnchor: string;
  toAnchor: string;
  flowAsset: string;
  lane: LaneId;
  /** Horizontal aisle used while travelling between equipment. Meters, world Z. */
  aisleZ: number;
  /** Short runs stay beside the equipment instead of detouring onto the rack. */
  direct: boolean;
}

/**
 * Directed process lines.
 * Tutorial chain, retagged to the approved visual IDs:
 * TK-201→P-401→E-101→T-101→T-102→CW-301→V-301, reflux V-301→T-102, product T-102→TK-202.
 * L09 and L10 are the cooling-water and tail-gas lines needed by the visible extra equipment.
 */
export const PIPES: PipeDef[] = [
  { id: 'L01', name: '原料出罐', from: 'TK-201', to: 'P-401', fromAnchor: 'outlet', toAnchor: 'suction', flowAsset: 'P-401', lane: 'L0', aisleZ: 0, direct: true },
  { id: 'L02', name: '泵送进料', from: 'P-401', to: 'E-101', fromAnchor: 'discharge', toAnchor: 'inlet', flowAsset: 'P-401', lane: 'L0', aisleZ: 6, direct: false },
  { id: 'L03', name: '预热进塔', from: 'E-101', to: 'T-101', fromAnchor: 'outlet', toAnchor: 'feed', flowAsset: 'E-101', lane: 'L0', aisleZ: 9, direct: false },
  { id: 'L04', name: '塔间输送', from: 'T-101', to: 'T-102', fromAnchor: 'overhead', toAnchor: 'feed', flowAsset: 'T-101', lane: 'L2', aisleZ: -1.2, direct: false },
  { id: 'L05', name: '塔顶冷凝', from: 'T-102', to: 'CW-301', fromAnchor: 'overhead', toAnchor: 'processIn', flowAsset: 'T-102', lane: 'L2', aisleZ: 2.4, direct: false },
  { id: 'L06', name: '凝液进罐', from: 'CW-301', to: 'V-301', fromAnchor: 'processOut', toAnchor: 'inlet', flowAsset: 'CW-301', lane: 'L2', aisleZ: 5, direct: false },
  { id: 'L07', name: '回流', from: 'V-301', to: 'T-102', fromAnchor: 'reflux', toAnchor: 'reflux', flowAsset: 'V-301', lane: 'L2', aisleZ: -3.2, direct: false },
  { id: 'L08', name: '产品出料', from: 'T-102', to: 'TK-202', fromAnchor: 'bottoms', toAnchor: 'inlet', flowAsset: 'TK-202', lane: 'L0', aisleZ: 11, direct: false },
  { id: 'L09', name: '冷却上水', from: 'CW-302', to: 'CW-301', fromAnchor: 'supply', toAnchor: 'waterIn', flowAsset: 'CW-302', lane: 'L0', aisleZ: 20, direct: true },
  { id: 'L10', name: '吸收尾气', from: 'T-103', to: 'T-104', fromAnchor: 'overhead', toAnchor: 'feed', flowAsset: 'T-103', lane: 'L1', aisleZ: -14, direct: false },
];

export const SITE = {
  /** Schematic site, not a survey. X east, Z south, -Z north, Y up. */
  width: 116,
  depth: 90,
  centerX: 32,
  centerZ: 4,
  assumption: '1 unit = 1 m。约 116×90 m 示意场地，不是测绘坐标。',
};

interface TowerSpec { x: number; z: number; h: number; r: number }
interface TankSpec { x: number; z: number; r: number; h: number }

export const TOWERS: Record<string, TowerSpec> = {
  'T-101': { x: -1.5, z: 12, h: 44, r: 2.25 },
  'T-102': { x: -1.5, z: -2, h: 40, r: 2.05 },
  'T-103': { x: 9, z: -18, h: 36, r: 1.85 },
  'T-104': { x: 20, z: -18, h: 33, r: 1.7 },
};

export const TANKS: Record<string, TankSpec> = {
  'TK-201': { x: 52, z: -6, r: 5.4, h: 16.5 },
  'TK-202': { x: 64, z: 9, r: 5.1, h: 15 },
};

export const RACK = { x0: 11, x1: 43, z0: -7, z1: 17 };

export const EQUIPMENT = {
  pump: { x: 46.4, z: 3.2 },
  exchanger: { x: 24, z: 6.2, length: 7.4, radius: 0.72 },
  drum: { x: 30.5, z: 1.1, length: 6.2, radius: 0.95 },
  cooler: { x: 31, z: 25 },
  basin: { x: 49, z: 28, w: 16, d: 9 },
};

export const FLOOR_BASE = [0, 13, 26] as const;

/** Extra meters inserted per floor index when the rack is expanded. */
export function floorY(floor: FloorIndex, gap: number): number {
  return FLOOR_BASE[floor] + gap * floor;
}

export function laneY(lane: LaneId, gap: number): number {
  if (lane === 'L0') return floorY(0, gap) + 3.6;
  if (lane === 'L1') return floorY(1, gap) + 1.55;
  return floorY(2, gap) + 1.65;
}

export function assetOrigin(id: string, gap: number): Vec3 {
  if (id in TOWERS) {
    const spec = TOWERS[id];
    return { x: spec.x, y: 0, z: spec.z };
  }
  if (id in TANKS) {
    const spec = TANKS[id];
    return { x: spec.x, y: 0, z: spec.z };
  }
  if (id === 'P-401') return { x: EQUIPMENT.pump.x, y: 0, z: EQUIPMENT.pump.z };
  if (id === 'E-101') return { x: EQUIPMENT.exchanger.x, y: 1.2, z: EQUIPMENT.exchanger.z };
  if (id === 'V-301') return { x: EQUIPMENT.drum.x, y: floorY(2, gap) + 1.75, z: EQUIPMENT.drum.z };
  if (id === 'CW-301') return { x: EQUIPMENT.cooler.x, y: 0, z: EQUIPMENT.cooler.z };
  if (id === 'CW-302') return { x: EQUIPMENT.basin.x, y: 0, z: EQUIPMENT.basin.z };
  if (id === 'PR-401') {
    return {
      x: (RACK.x0 + RACK.x1) / 2,
      y: floorY(1, gap),
      z: (RACK.z0 + RACK.z1) / 2,
    };
  }
  throw new Error(`unknown asset ${id}`);
}

export function anchorWorld(id: string, anchor: string, gap: number): Vec3 {
  const origin = assetOrigin(id, gap);
  if (id in TOWERS) {
    const spec = TOWERS[id];
    if (anchor === 'feed') return { x: origin.x + spec.r + 0.55, y: spec.h * 0.32, z: origin.z };
    if (anchor === 'overhead') return { x: origin.x + 0.15, y: spec.h + 0.2, z: origin.z };
    if (anchor === 'bottoms') return { x: origin.x + spec.r + 0.45, y: 1.45, z: origin.z + 0.35 };
    if (anchor === 'reflux') return { x: origin.x + spec.r + 0.5, y: spec.h * 0.62, z: origin.z - 0.4 };
  }
  if (id in TANKS) {
    const spec = TANKS[id];
    if (anchor === 'outlet') return { x: origin.x - spec.r - 0.25, y: 1.25, z: origin.z };
    if (anchor === 'inlet') return { x: origin.x - spec.r - 0.25, y: 2.5, z: origin.z + 0.55 };
  }
  if (id === 'P-401') {
    if (anchor === 'suction') return { x: origin.x - 1.2, y: 0.58, z: origin.z };
    if (anchor === 'discharge') return { x: origin.x + 1.05, y: 0.95, z: origin.z };
  }
  if (id === 'E-101') {
    const half = EQUIPMENT.exchanger.length / 2;
    if (anchor === 'inlet') return { x: origin.x + half + 0.3, y: origin.y + 0.38, z: origin.z };
    if (anchor === 'outlet') return { x: origin.x - half - 0.3, y: origin.y + 0.38, z: origin.z };
  }
  if (id === 'V-301') {
    const half = EQUIPMENT.drum.length / 2;
    if (anchor === 'inlet') return { x: origin.x + half + 0.25, y: origin.y + 0.28, z: origin.z };
    if (anchor === 'reflux') return { x: origin.x - half - 0.25, y: origin.y - 0.12, z: origin.z };
  }
  if (id === 'CW-301') {
    if (anchor === 'processIn') return { x: origin.x - 4.4, y: 2.45, z: origin.z - 1.3 };
    if (anchor === 'processOut') return { x: origin.x + 4.4, y: 1.85, z: origin.z - 1.3 };
    if (anchor === 'waterIn') return { x: origin.x, y: 0.6, z: origin.z + 2.3 };
  }
  if (id === 'CW-302' && anchor === 'supply') {
    return { x: origin.x, y: 0.5, z: origin.z - EQUIPMENT.basin.d / 2 };
  }
  throw new Error(`unknown anchor ${id}.${anchor}`);
}

export function buildWaypoints(pipeId: string, gap: number): Vec3[] {
  const pipe = PIPES.find((item) => item.id === pipeId);
  if (!pipe) throw new Error(`unknown pipe ${pipeId}`);
  const start = anchorWorld(pipe.from, pipe.fromAnchor, gap);
  const end = anchorWorld(pipe.to, pipe.toAnchor, gap);
  const elevation = laneY(pipe.lane, gap);
  const raw = pipe.direct
    ? directRoute(start, end, elevation)
    : aisleRoute(start, end, elevation, pipe.aisleZ);
  return filletPolyline(raw, 0.9, 4);
}

export function connectedPipeIds(assetId: string): string[] {
  return PIPES.filter((pipe) => pipe.from === assetId || pipe.to === assetId).map((pipe) => pipe.id);
}

export function neighborIds(assetId: string): string[] {
  const ids = new Set<string>();
  for (const pipe of PIPES) {
    if (pipe.from === assetId) ids.add(pipe.to);
    if (pipe.to === assetId) ids.add(pipe.from);
  }
  return [...ids];
}

export interface DressingPoint { x: number; z: number; scale: number; kind: 'street' | 'archive' }

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDressing(): DressingPoint[] {
  const random = mulberry32(20261119);
  const points: DressingPoint[] = [];
  for (let i = 0; i < 28; i += 1) {
    const angle = (i / 28) * Math.PI * 2 + 0.15;
    points.push({
      x: SITE.centerX + Math.cos(angle) * 48 + (random() - 0.5) * 2.4,
      z: SITE.centerZ + Math.sin(angle) * 38 + (random() - 0.5) * 1.8,
      scale: 0.82 + random() * 0.45,
      kind: 'street',
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2 + 0.4;
    points.push({
      x: SITE.centerX + Math.cos(angle) * 54,
      z: SITE.centerZ + Math.sin(angle) * 42,
      scale: 0.38,
      kind: 'archive',
    });
  }
  return points;
}

export const DRESSING = buildDressing();

export const FENCE = { x0: -2, x1: 70, z0: -30, z1: 40 };
export const TRUCK = { x: 22, z: 36.5 };

export function labelAnchor(id: string, gap: number): Vec3 {
  const origin = assetOrigin(id, gap);
  if (id in TOWERS) return { x: origin.x, y: TOWERS[id].h + 1.4, z: origin.z };
  if (id in TANKS) return { x: origin.x, y: TANKS[id].h + 2.2, z: origin.z };
  if (id === 'E-101') return { x: origin.x, y: origin.y + 2.4, z: origin.z };
  if (id === 'V-301') return { x: origin.x, y: origin.y + 2.3, z: origin.z };
  if (id === 'P-401') return { x: origin.x, y: 3.2, z: origin.z };
  if (id === 'CW-301') return { x: origin.x, y: 5.4, z: origin.z };
  if (id === 'CW-302') return { x: origin.x, y: 3.2, z: origin.z };
  return { x: origin.x, y: origin.y + 16, z: origin.z };
}
