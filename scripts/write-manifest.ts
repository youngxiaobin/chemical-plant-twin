import { writeFileSync, mkdirSync } from 'node:fs';
import { ASSETS, PIPES, SITE, TOWERS, TANKS, EQUIPMENT, assetOrigin } from '../src/sim/plant.ts';
import { DISCLAIMER } from '../src/sim/types.ts';

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function vec(value: { x: number; y: number; z: number }) {
  return { x: round(value.x), y: round(value.y), z: round(value.z) };
}

function sizeOf(id: string): Record<string, number> {
  if (id in TOWERS) return { height: TOWERS[id].h, radius: TOWERS[id].r };
  if (id in TANKS) return { height: TANKS[id].h, radius: TANKS[id].r };
  if (id === 'E-101') return { length: EQUIPMENT.exchanger.length, radius: EQUIPMENT.exchanger.radius };
  if (id === 'V-301') return { length: EQUIPMENT.drum.length, radius: EQUIPMENT.drum.radius };
  if (id === 'CW-302') return { width: EQUIPMENT.basin.w, depth: EQUIPMENT.basin.d };
  if (id === 'P-401') return { length: 2.4, width: 1.1, height: 1.3 };
  if (id === 'CW-301') return { length: 10.5, width: 4.2, height: 3.2 };
  return { length: 32, width: 24, topElevation: 26 };
}

const manifest = {
  units: 'm',
  up: '+Y',
  east: '+X',
  north: '-Z',
  site: SITE,
  disclaimer: DISCLAIMER,
  geometry: '主体为原创参数化示意几何，不是工程测量模型，也不是 tevy 炼油模块的整厂复制。',
  assets: ASSETS.map((asset) => ({
    id: asset.id,
    name: asset.name,
    group: asset.group,
    kind: asset.kind,
    floors: asset.floors,
    tutorialAnalog: asset.tutorialAnalog,
    origin: vec(assetOrigin(asset.id, 0)),
    size: sizeOf(asset.id),
    assumptions: '示意尺寸与标高，1 unit = 1 m。楼层基准 0 / 13 / 26 m。展开时每层额外抬升。',
  })),
  pipes: PIPES.map((pipe) => ({
    id: pipe.id,
    name: pipe.name,
    from: pipe.from,
    to: pipe.to,
    fromAnchor: pipe.fromAnchor,
    toAnchor: pipe.toAnchor,
    flowAsset: pipe.flowAsset,
    lane: pipe.lane,
  })),
};

mkdirSync(new URL('../public/assets/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/assets/manifest.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[manifest] ${manifest.assets.length} assets, ${manifest.pipes.length} pipes`);
