import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';

function gratingTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建格栅纹理');
  context.clearRect(0, 0, 128, 128);
  context.strokeStyle = '#d7c48a';
  context.lineWidth = 3;
  for (let i = 4; i < 128; i += 8) {
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, 128);
    context.stroke();
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(128, i);
    context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function skyTexture(top: string, bottom: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建天空纹理');
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 256);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function nameplateTexture(id: string, name: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建铭牌');
  context.fillStyle = '#102028';
  context.fillRect(0, 0, 256, 128);
  context.strokeStyle = '#49d4ea';
  context.lineWidth = 6;
  context.strokeRect(6, 6, 244, 116);
  context.fillStyle = '#e7f8ff';
  context.font = 'bold 46px "WenQuanYi Micro Hei", "Microsoft YaHei", sans-serif';
  context.fillText(id, 20, 58);
  context.fillStyle = '#9fd4e0';
  context.font = '28px "WenQuanYi Micro Hei", "Microsoft YaHei", sans-serif';
  context.fillText(name, 20, 98);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function attachScan(material: MeshStandardMaterial, assetId: string): MeshStandardMaterial {
  material.userData.assetId = assetId;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uScan = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vScanWorld;')
      .replace(
        '#include <project_vertex>',
        'vScanWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#include <project_vertex>',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uScan;\nvarying vec3 vScanWorld;')
      .replace(
        '#include <opaque_fragment>',
        `
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
        outgoingLight += vec3(0.28, 0.62, 0.72) * fres * 0.38;
        float scan = smoothstep(0.16, 0.0, abs(fract(vScanWorld.y * 0.07 - uTime * 0.1) - 0.1));
        outgoingLight += vec3(0.25, 0.9, 1.0) * scan * uScan;
        #include <opaque_fragment>
        `,
      );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => `scan-${assetId}`;
  return material;
}

export function createMetal(color: string, assetId: string, metalness = 0.78, roughness = 0.34): MeshStandardMaterial {
  const material = new MeshStandardMaterial({
    color: new Color(color),
    metalness,
    roughness,
    envMapIntensity: 0.55,
  });
  return attachScan(material, assetId);
}

export class SurfaceMaterials {
  readonly ground = new MeshStandardMaterial({ color: '#66727a', roughness: 0.92, metalness: 0.02 });
  readonly pad = new MeshStandardMaterial({ color: '#8b969c', roughness: 0.78, metalness: 0.08 });
  readonly road = new MeshStandardMaterial({ color: '#343c46', roughness: 0.9, metalness: 0.04 });
  readonly concrete = new MeshStandardMaterial({ color: '#8e9894', roughness: 0.84, metalness: 0.05 });
  readonly gold = createMetal('#e0b15a', 'PR-401', 0.55, 0.42);
  readonly pipeSteel = new MeshStandardMaterial({ color: '#9aa6ae', metalness: 0.7, roughness: 0.36 });
  readonly dark = new MeshStandardMaterial({ color: '#2c3438', metalness: 0.45, roughness: 0.55 });
  readonly white = new MeshStandardMaterial({ color: '#e7e4dc', metalness: 0.15, roughness: 0.55 });
  readonly glass = new MeshStandardMaterial({ color: '#1c2a30', metalness: 0.1, roughness: 0.15 });
  readonly leaf = new MeshStandardMaterial({ color: '#2f7a45', roughness: 0.86, metalness: 0.02 });
  readonly trunk = new MeshStandardMaterial({ color: '#6a5138', roughness: 0.9, metalness: 0.02 });
  readonly lamp = new MeshStandardMaterial({ color: '#d7dde2', metalness: 0.6, roughness: 0.35 });
  readonly lampHead = new MeshStandardMaterial({
    color: '#ffe3ad',
    emissive: '#ffc56a',
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });
  readonly grating = new MeshStandardMaterial({
    map: gratingTexture(),
    color: '#e1c27a',
    metalness: 0.45,
    roughness: 0.48,
    alphaTest: 0.35,
    side: DoubleSide,
  });
  readonly mark = new MeshStandardMaterial({ color: '#d5dde2', roughness: 0.6 });

  setWet(amount: number): void {
    const wet = Math.min(1, Math.max(0, amount));
    this.ground.roughness = 0.94 - wet * 0.55;
    this.ground.color.set(wet > 0.05 ? '#556168' : '#66727a');
    this.road.roughness = 0.92 - wet * 0.5;
    this.road.color.set(wet > 0.05 ? '#2c343c' : '#3d4650');
    this.pad.roughness = 0.8 - wet * 0.35;
    this.concrete.roughness = 0.86 - wet * 0.4;
  }
}
