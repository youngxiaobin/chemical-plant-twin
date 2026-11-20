import type { Vec3 } from './types.ts';

export function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function dedupe(points: Vec3[], epsilon = 0.05): Vec3[] {
  const out: Vec3[] = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (!prev || dist(prev, point) > epsilon) out.push(point);
  }
  return out;
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function quad(a: Vec3, control: Vec3, b: Vec3, t: number): Vec3 {
  const ab = lerp(a, control, t);
  const cb = lerp(control, b, t);
  return lerp(ab, cb, t);
}

/** Keep endpoints fixed and replace sharp corners with a short quadratic fillet. */
export function filletPolyline(points: Vec3[], radius: number, segments = 4): Vec3[] {
  if (points.length < 3) return points.slice();
  const out: Vec3[] = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const d1 = dist(prev, current);
    const d2 = dist(current, next);
    const r = Math.min(radius, d1 * 0.45, d2 * 0.45);
    if (r < 0.08) {
      out.push(current);
      continue;
    }
    const towardPrev = lerp(current, prev, r / d1);
    const towardNext = lerp(current, next, r / d2);
    out.push(towardPrev);
    for (let step = 1; step < segments; step += 1) {
      out.push(quad(towardPrev, current, towardNext, step / segments));
    }
    out.push(towardNext);
  }
  out.push(points[points.length - 1]);
  return out;
}

export function directRoute(a: Vec3, b: Vec3, laneY: number): Vec3[] {
  return dedupe([
    a,
    { x: a.x, y: laneY, z: a.z },
    { x: b.x, y: laneY, z: a.z },
    { x: b.x, y: laneY, z: b.z },
    b,
  ]);
}

export function aisleRoute(a: Vec3, b: Vec3, laneY: number, aisleZ: number): Vec3[] {
  return dedupe([
    a,
    { x: a.x, y: laneY, z: a.z },
    { x: a.x, y: laneY, z: aisleZ },
    { x: b.x, y: laneY, z: aisleZ },
    { x: b.x, y: laneY, z: b.z },
    b,
  ]);
}
