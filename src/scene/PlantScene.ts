import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Clock,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  InstancedMesh,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  ASSETS,
  DRESSING,
  PIPES,
  assetById,
  assetOrigin,
  buildWaypoints,
  labelAnchor,
  neighborIds,
} from '../sim/plant.ts';
import { flowSpeed } from '../sim/telemetry.ts';
import type { TelemetryFrame } from '../sim/types.ts';
import type { FloorFilter, LinkStatus, QualityTier, WeatherState } from '../sim/view.ts';
import {
  createBasin,
  createCooler,
  createDrum,
  createExchanger,
  createLamps,
  createPump,
  createRack,
  createSite,
  createTank,
  createTower,
} from './geometry.ts';
import { SurfaceMaterials, skyTexture } from './materials.ts';
import flowVert from '../shaders/flow.vert.glsl?raw';
import flowFrag from '../shaders/flow.frag.glsl?raw';
import waterVert from '../shaders/water.vert.glsl?raw';
import waterFrag from '../shaders/water.frag.glsl?raw';
import rainVert from '../shaders/rain.vert.glsl?raw';
import rainFrag from '../shaders/rain.frag.glsl?raw';

const HOME = {
  position: new Vector3(-8, 46, 72),
  target: new Vector3(26, 8, 0),
};
const TOP = {
  position: new Vector3(32, 120, 6),
  target: new Vector3(32, 0, 2),
};

export interface SceneDiagnostics {
  fps: number;
  draws: number;
  triangles: number;
  geometries: number;
  textures: number;
  treeArchive: 'pending' | 'loaded' | 'fallback';
  quality: QualityTier;
  dpr: number;
}

interface PipeRuntime {
  id: string;
  from: string;
  to: string;
  flowAsset: string;
  mesh: Mesh;
  material: ShaderMaterial;
  curve: CatmullRomCurve3;
}

export class PlantScene {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly css: CSS2DRenderer;
  private readonly clock = new Clock();
  private readonly surfaces = new SurfaceMaterials();
  private readonly assets = new Map<string, Object3D>();
  private readonly labels = new Map<string, HTMLDivElement>();
  private readonly pipes: PipeRuntime[] = [];
  private readonly fans: Object3D[] = [];
  private readonly sun: DirectionalLight;
  private readonly hemi: HemisphereLight;
  private readonly lampLights: PointLight[] = [];
  private rain: LineSegments | null = null;
  private rainMaterial: ShaderMaterial | null = null;
  private readonly waterMaterial: ShaderMaterial;
  private particles: InstancedMesh | null = null;
  private steam: InstancedMesh | null = null;
  private reflector: Reflector | null = null;
  private readonly puddles: Mesh[] = [];
  private vane: Object3D | null = null;
  private ring: Mesh | null = null;
  private frameId = 0;
  private running = true;
  private frame: TelemetryFrame | null = null;
  private link: LinkStatus = 'connecting';
  private selected: string | null = null;
  private floor: FloorFilter = 'all';
  private expanded = false;
  private isolated = false;
  private quality: QualityTier = 'medium';
  private weather: WeatherState;
  private reducedMotion = false;
  private touring = false;
  private tourIndex = 0;
  private tourElapsed = 0;
  private fps = 0;
  private fpsFrames = 0;
  private fpsElapsed = 0;
  private treeArchive: SceneDiagnostics['treeArchive'] = 'pending';
  private readonly onPick: (id: string | null) => void;
  private readonly host: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private pointerDown = new Vector2();
  private sky: ReturnType<typeof skyTexture> | null = null;

  constructor(host: HTMLElement, weather: WeatherState, onPick: (id: string | null) => void, onFatal: (message: string) => void) {
    this.host = host;
    this.weather = weather;
    this.onPick = onPick;
    this.surfaces.gold.emissive.set('#6b4a16');
    this.surfaces.gold.emissiveIntensity = 0.32;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'webgl';
    host.appendChild(this.canvas);
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (error) {
      onFatal(error instanceof Error ? error.message : '无法创建 WebGL 画布');
      throw error;
    }
    if (!renderer.getContext()) {
      onFatal('浏览器没有提供可用的 WebGL 上下文');
      throw new Error('no webgl');
    }
    this.renderer = renderer;
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setPixelRatio(this.pixelRatio());

    this.camera = new PerspectiveCamera(42, 1, 0.5, 500);
    this.camera.position.copy(HOME.position);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.copy(HOME.target);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 240;
    this.controls.addEventListener('start', () => {
      this.touring = false;
    });

    this.css = new CSS2DRenderer();
    this.css.domElement.className = 'labels';
    host.appendChild(this.css.domElement);

    this.hemi = new HemisphereLight('#d5e4ee', '#6a7370', 0.72);
    this.sun = new DirectionalLight('#fff4dd', 1.45);
    this.sun.position.set(48, 72, 26);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.target.position.set(28, 0, 4);

    this.waterMaterial = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uRain: { value: 0.4 } },
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      transparent: true,
    });

    this.scene.add(createSite(this.surfaces));
    const lamps = createLamps(this.surfaces);
    this.scene.add(lamps.group);
    lamps.heads.slice(0, 4).forEach((head, index) => {
      const light = new PointLight('#ffd2a1', 0, 16, 2);
      light.position.copy(head.position);
      this.lampLights.push(light);
      this.scene.add(light);
      if (index === 0) this.vane = this.createVane(head.position.x + 4, head.position.z);
    });
    for (const id of ['T-101', 'T-102', 'T-103', 'T-104']) this.addAsset(createTower(id));
    for (const id of ['TK-201', 'TK-202']) this.addAsset(createTank(id));
    this.addAsset(createPump());
    this.addAsset(createExchanger());
    this.addAsset(createDrum());
    const cooler = createCooler();
    this.fans.push(...cooler.fans);
    this.addAsset(cooler.group);
    const basin = createBasin(this.waterMaterial);
    this.addAsset(basin.group);
    this.addAsset(createRack(0, this.surfaces));
    this.rebuildPipes(0);
    this.createLabels();
    this.createParticles();
    this.createPuddles();
    this.ring = new Mesh(
      new RingGeometry(0.78, 1, 48),
      new MeshBasicMaterial({ color: 0x5cefff, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);
    this.applyWeather();
    this.resize();
    this.bindPointer();
    window.addEventListener('resize', this.resize);
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      onFatal('WebGL 上下文已丢失。请刷新页面。');
      this.running = false;
    });
    void this.loadArchiveTrees();
    this.frameId = requestAnimationFrame(this.animate);
  }

  setFrame(frame: TelemetryFrame | null, link: LinkStatus): void {
    this.frame = frame;
    this.link = link;
    this.refreshTags();
  }

  setSelection(id: string | null): void {
    this.selected = id;
    this.applyVisibility();
    this.refreshTags();
    this.placeRing();
  }

  setFloor(floor: FloorFilter, expanded: boolean, isolated: boolean): void {
    const gapChanged = expanded !== this.expanded;
    this.floor = floor;
    this.expanded = expanded;
    this.isolated = isolated;
    if (gapChanged) this.relayout();
    else this.applyVisibility();
    this.placeRing();
    this.refreshTags();
  }

  setWeather(weather: WeatherState): void {
    this.weather = weather;
    this.applyWeather();
  }

  setQuality(quality: QualityTier): void {
    this.quality = quality;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.sun.shadow.mapSize.set(quality === 'high' ? 4096 : 2048, quality === 'high' ? 4096 : 2048);
    this.rebuildRain();
    this.syncReflector();
    this.resize();
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.controls.enableDamping = !enabled;
  }

  resetView(): void {
    this.touring = false;
    this.moveCamera(HOME.position, HOME.target, true);
  }

  topView(): void {
    this.touring = false;
    this.moveCamera(TOP.position, TOP.target, true);
  }

  toggleTour(): boolean {
    this.touring = !this.touring;
    this.tourElapsed = 0;
    return this.touring;
  }

  focus(id: string): void {
    const origin = assetOrigin(id, this.gap());
    const target = new Vector3(origin.x, Math.max(4, origin.y + 4), origin.z);
    const position = target.clone().add(new Vector3(-16, 12, 18));
    this.touring = false;
    this.moveCamera(position, target, true);
  }

  diagnostics(): SceneDiagnostics {
    return {
      fps: this.fps,
      draws: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      treeArchive: this.treeArchive,
      quality: this.quality,
      dpr: this.renderer.getPixelRatio(),
    };
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    this.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else if (material) material.dispose();
    });
    this.sky?.dispose();
    this.renderer.dispose();
    this.canvas.remove();
    this.css.domElement.remove();
  }

  private gap(): number {
    return this.expanded ? 10 : 0;
  }

  private pixelRatio(): number {
    const native = window.devicePixelRatio || 1;
    if (this.quality === 'low') return 1;
    if (this.quality === 'high') return Math.min(native, 1.75);
    return Math.min(native, 1.35);
  }

  private addAsset(object: Object3D): void {
    const id = object.userData.assetId as string;
    this.assets.set(id, object);
    this.scene.add(object);
  }

  private relayout(): void {
    const gap = this.gap();
    const drum = this.assets.get('V-301');
    if (drum) {
      const origin = assetOrigin('V-301', gap);
      drum.position.set(origin.x, origin.y, origin.z);
    }
    const previous = this.assets.get('PR-401');
    if (previous) {
      this.scene.remove(previous);
      disposeObject(previous);
    }
    const rack = createRack(gap, this.surfaces);
    this.addAsset(rack);
    this.rebuildPipes(gap);
    this.applyVisibility();
  }

  private rebuildPipes(gap: number): void {
    for (const pipe of this.pipes) {
      this.scene.remove(pipe.mesh);
      pipe.mesh.geometry.dispose();
      pipe.material.dispose();
    }
    this.pipes.length = 0;
    for (const def of PIPES) {
      const points = buildWaypoints(def.id, gap).map((point) => new Vector3(point.x, point.y, point.z));
      const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.12);
      const geometry = new TubeGeometry(curve, Math.max(32, points.length * 3), 0.46, 8, false);
      const material = new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: 0 },
          uHighlight: { value: 0 },
        },
        vertexShader: flowVert,
        fragmentShader: flowFrag,
        transparent: true,
      });
      const mesh = new Mesh(geometry, material);
      mesh.userData.pipeId = def.id;
      this.scene.add(mesh);
      this.pipes.push({ id: def.id, from: def.from, to: def.to, flowAsset: def.flowAsset, mesh, material, curve });
    }
    this.layoutParticles();
  }

  private createParticles(): void {
    const geometry = new SphereGeometry(0.18, 6, 5);
    const material = new MeshBasicMaterial({ color: 0xc6fbff, transparent: true, opacity: 0.92 });
    this.particles = new InstancedMesh(geometry, material, PIPES.length * 10);
    this.particles.frustumCulled = false;
    this.scene.add(this.particles);
    const steamGeometry = new PlaneGeometry(0.8, 1.4);
    const steamMaterial = new MeshBasicMaterial({ color: 0xd5e4e8, transparent: true, opacity: 0.28, depthWrite: false });
    this.steam = new InstancedMesh(steamGeometry, steamMaterial, 16);
    this.steam.frustumCulled = false;
    this.scene.add(this.steam);
    this.layoutParticles();
  }

  private layoutParticles(): void {
    if (!this.particles) return;
    const dummy = new Object3D();
    this.pipes.forEach((pipe, pipeIndex) => {
      for (let i = 0; i < 10; i += 1) {
        const point = pipe.curve.getPoint(i / 10);
        dummy.position.copy(point);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        this.particles?.setMatrixAt(pipeIndex * 10 + i, dummy.matrix);
      }
    });
    this.particles.instanceMatrix.needsUpdate = true;
  }

  private createLabels(): void {
    for (const asset of ASSETS) {
      const element = document.createElement('div');
      element.className = 'eq-tag';
      element.innerHTML = `<b>${asset.id}</b><span>${asset.name}</span>`;
      const object = new CSS2DObject(element);
      const anchor = labelAnchor(asset.id, 0);
      object.position.set(anchor.x, anchor.y, anchor.z);
      this.scene.add(object);
      this.labels.set(asset.id, element);
      element.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.onPick(asset.id);
      });
    }
  }

  private createPuddles(): void {
    const material = this.waterMaterial;
    for (const spot of [
      [18, 20],
      [40, 18],
      [8, 22],
      [62, 20],
    ] as const) {
      const puddle = new Mesh(new PlaneGeometry(3.4, 2.2), material);
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.set(spot[0], 0.05, spot[1]);
      puddle.renderOrder = 2;
      this.scene.add(puddle);
      this.puddles.push(puddle);
    }
  }

  private createVane(x: number, z: number): Object3D {
    const group = new Object3D();
    const pole = new Mesh(new CylinderGeometry(0.04, 0.05, 3.2, 6), this.surfaces.dark);
    pole.position.y = 1.6;
    const flag = new Mesh(new PlaneGeometry(1.4, 0.35), this.surfaces.lampHead);
    flag.position.set(0.7, 3.2, 0);
    group.add(pole, flag);
    group.position.set(x, 0, z);
    group.visible = false;
    this.scene.add(group);
    return group;
  }

  private rebuildRain(): void {
    if (this.rain) {
      this.scene.remove(this.rain);
      this.rain.geometry.dispose();
    }
    const count = this.quality === 'low' ? 500 : this.quality === 'high' ? 2800 : 1500;
    const positions = new Float32Array(count * 6);
    for (let i = 0; i < count; i += 1) resetDrop(positions, i, true);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this.rainMaterial = new ShaderMaterial({
      uniforms: { uStrength: { value: 0.7 } },
      vertexShader: rainVert,
      fragmentShader: rainFrag,
      transparent: true,
      depthWrite: false,
    });
    this.rain = new LineSegments(geometry, this.rainMaterial);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  private syncReflector(): void {
    const basin = this.assets.get('CW-302');
    if (this.quality !== 'high') {
      if (this.reflector) {
        this.reflector.visible = false;
      }
      const water = basin?.getObjectByName('basin-water');
      if (water) water.visible = true;
      return;
    }
    if (!this.reflector) {
      const reflector = new Reflector(new PlaneGeometry(14.6, 7.6), {
        clipBias: 0.003,
        textureWidth: 768,
        textureHeight: 768,
        color: 0x234448,
      });
      reflector.rotation.x = -Math.PI / 2;
      reflector.position.set(49, 0.46, 28);
      this.scene.add(reflector);
      this.reflector = reflector;
    }
    this.reflector.visible = true;
    const water = basin?.getObjectByName('basin-water');
    if (water) water.visible = false;
  }

  private applyWeather(): void {
    const weather = this.weather;
    const storm = weather.mode === 'storm';
    const night = weather.night;
    this.sky?.dispose();
    this.sky = skyTexture(
      night ? '#121a24' : storm ? '#667684' : '#9eb0bc',
      night ? '#1b242c' : storm ? '#7f8d96' : '#c5d0d6',
    );
    this.scene.background = this.sky;
    const rain = weather.particles ? weather.rain : 0;
    const density = weather.fog ? (night ? 0.004 : 0.006) + rain * 0.012 + (storm ? 0.004 : 0) : 0.0015;
    this.scene.fog = new FogExp2(night ? '#1a232b' : storm ? '#8b989f' : '#b7c3c9', density);
    this.sun.intensity = night ? 0.28 : storm ? 0.85 : 1.35 - rain * 0.25;
    this.sun.color.set(night ? '#9eb4d6' : '#fff2d8');
    this.hemi.intensity = night ? 0.38 : 0.75;
    this.hemi.color.set(night ? '#223044' : '#d7e6ef');
    this.surfaces.lampHead.emissiveIntensity = night ? 1.5 : 0.22 + rain * 0.15;
    for (const light of this.lampLights) light.intensity = night ? 6 : 0;
    this.surfaces.setWet(weather.wet ? Math.max(weather.rain, storm ? 0.8 : 0.2) : 0);
    if (this.vane) this.vane.visible = weather.vane;
    for (const puddle of this.puddles) puddle.visible = weather.puddles && weather.rain > 0.08;
    this.waterMaterial.uniforms.uRain.value = weather.rain;
    if (!this.rain) this.rebuildRain();
    if (this.rain) this.rain.visible = weather.particles && weather.rain > 0.03;
    if (this.rainMaterial) this.rainMaterial.uniforms.uStrength.value = 0.25 + weather.rain * 0.7;
    this.syncReflector();
    this.renderer.toneMappingExposure = night ? 0.92 : 1.12 - rain * 0.08;
  }

  private applyVisibility(): void {
    for (const asset of ASSETS) {
      const object = this.assets.get(asset.id);
      if (!object) continue;
      object.visible = this.assetVisible(asset.id);
    }
    for (const pipe of this.pipes) {
      const touches = pipe.from === this.selected || pipe.to === this.selected;
      const endsVisible = this.assetVisible(pipe.from) && this.assetVisible(pipe.to);
      pipe.mesh.visible = this.isolated && this.selected ? touches : endsVisible;
      pipe.material.uniforms.uHighlight.value = touches && this.selected ? 1 : 0;
    }
    for (const [id, element] of this.labels) {
      const object = element.parentElement ? this.scene.children.find((child) => child instanceof CSS2DObject && child.element === element) : null;
      if (object) object.visible = this.assetVisible(id);
      element.classList.toggle('selected', id === this.selected);
    }
  }

  private assetVisible(id: string): boolean {
    if (this.isolated && this.selected) {
      return id === this.selected || neighborIds(this.selected).includes(id);
    }
    if (this.floor === 'all') return true;
    return assetById(id).floors.includes(this.floor);
  }

  private refreshTags(): void {
    const stale = this.link === 'stale' || this.link === 'offline';
    for (const asset of ASSETS) {
      const element = this.labels.get(asset.id);
      if (!element) continue;
      element.classList.toggle('selected', asset.id === this.selected);
      const reading = this.frame?.assets[asset.id];
      element.classList.remove('alarm', 'warning', 'stale');
      if (stale) element.classList.add('stale');
      else if (reading?.status === 'alarm') element.classList.add('alarm');
      else if (reading?.status === 'warning') element.classList.add('warning');
      const anchor = labelAnchor(asset.id, this.gap());
      const labelObject = this.scene.children.find((child) => child instanceof CSS2DObject && child.element === element);
      if (labelObject) labelObject.position.set(anchor.x, anchor.y, anchor.z);
    }
  }

  private placeRing(): void {
    if (!this.ring) return;
    if (!this.selected) {
      this.ring.visible = false;
      return;
    }
    const origin = assetOrigin(this.selected, this.gap());
    const asset = assetById(this.selected);
    this.ring.visible = true;
    this.ring.position.set(origin.x, 0.18, origin.z);
    const scale = Math.max(2.4, asset.radius);
    this.ring.scale.set(scale, scale, scale);
  }

  private moveCamera(position: Vector3, target: Vector3, jump: boolean): void {
    if (jump || this.reducedMotion) {
      this.camera.position.copy(position);
      this.controls.target.copy(target);
      return;
    }
    this.camera.position.lerp(position, 0.08);
    this.controls.target.lerp(target, 0.08);
  }

  private bindPointer(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.pointerDown.set(event.clientX, event.clientY);
    });
    this.canvas.addEventListener('pointerup', (event) => {
      if (this.pointerDown.distanceTo(new Vector2(event.clientX, event.clientY)) > 6) return;
      const rect = this.canvas.getBoundingClientRect();
      const ndc = new Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new Raycaster();
      raycaster.setFromCamera(ndc, this.camera);
      const hits = raycaster.intersectObjects(this.scene.children, true);
      const hit = hits.find((item) => item.object.visible && findAssetId(item.object));
      this.onPick(hit ? findAssetId(hit.object) : null);
    });
  }

  private resize = (): void => {
    const width = this.host.clientWidth || 1;
    const height = this.host.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.css.setSize(width, height);
  };

  private animate = (): void => {
    if (!this.running) return;
    this.frameId = requestAnimationFrame(this.animate);
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    this.controls.update();
    this.updateTour(dt);
    this.updateFlow(time);
    this.updateFans(dt);
    this.updateRain(dt);
    this.updateSteam(time);
    this.updateScan(time);
    if (this.vane && this.vane.visible) {
      this.vane.rotation.y = Math.sin(time * (0.4 + this.weather.wind)) * 0.4 + 0.8;
    }
    if (this.weather.lightning && this.weather.mode === 'storm' && !this.reducedMotion && Math.random() < 0.008) {
      this.sun.intensity = 2.4;
    }
    this.renderer.render(this.scene, this.camera);
    this.css.render(this.scene, this.camera);
    this.fpsFrames += 1;
    this.fpsElapsed += dt;
    if (this.fpsElapsed >= 0.5) {
      this.fps = this.fpsFrames / this.fpsElapsed;
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
    }
  };

  private updateTour(dt: number): void {
    if (!this.touring) return;
    const poses = [HOME, TOP, { position: new Vector3(6, 24, 34), target: new Vector3(4, 14, 2) }, { position: new Vector3(90, 34, 42), target: new Vector3(52, 6, 6) }];
    const pose = poses[this.tourIndex % poses.length];
    if (this.reducedMotion) {
      this.moveCamera(pose.position, pose.target, true);
      this.tourIndex += 1;
      this.touring = false;
      return;
    }
    this.moveCamera(pose.position, pose.target, false);
    this.tourElapsed += dt;
    if (this.tourElapsed > 5.5) {
      this.tourElapsed = 0;
      this.tourIndex += 1;
    }
  }

  private updateFlow(time: number): void {
    const hold = !this.frame || this.frame.paused || this.link === 'stale' || this.link === 'offline';
    const dummy = new Object3D();
    this.pipes.forEach((pipe, pipeIndex) => {
      const flow = this.frame?.assets[pipe.flowAsset]?.flow.value ?? 0;
      const speed = flowSpeed(flow, hold);
      pipe.material.uniforms.uTime.value = time;
      pipe.material.uniforms.uSpeed.value = this.reducedMotion ? speed * 0.35 : speed;
      if (!this.particles) return;
      for (let i = 0; i < 10; i += 1) {
        const phase = (i / 10 + time * speed * 0.12) % 1;
        const point = pipe.curve.getPoint(hold ? i / 10 : phase);
        dummy.position.copy(point);
        dummy.scale.setScalar(speed === 0 ? 0.35 : 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.particles.setMatrixAt(pipeIndex * 10 + i, dummy.matrix);
      }
    });
    if (this.particles) this.particles.instanceMatrix.needsUpdate = true;
  }

  private updateFans(dt: number): void {
    if (this.reducedMotion) return;
    const flow = this.frame?.assets['CW-301']?.flow.value ?? 80;
    const hold = !this.frame || this.frame.paused || this.link === 'stale' || this.link === 'offline';
    const rate = hold ? 0 : 1.5 + flow / 40;
    for (const fan of this.fans) fan.rotation.y += dt * rate;
  }

  private updateRain(dt: number): void {
    if (!this.rain || !this.rain.visible) return;
    const positions = this.rain.geometry.getAttribute('position') as BufferAttribute;
    const array = positions.array as Float32Array;
    const count = array.length / 6;
    const speed = (this.reducedMotion ? 2 : 18) + this.weather.rain * 26;
    const wind = this.weather.wind * 8;
    for (let i = 0; i < count; i += 1) {
      const base = i * 6;
      array[base + 1] -= speed * dt;
      array[base + 4] -= speed * dt;
      array[base] += wind * dt;
      array[base + 3] += wind * dt;
      if (array[base + 1] < 0) resetDrop(array, i, false);
    }
    positions.needsUpdate = true;
  }

  private updateSteam(time: number): void {
    if (!this.steam) return;
    const cooler = this.assets.get('CW-301');
    const running = (this.frame?.assets['CW-301']?.flow.value ?? 0) > 20 || (this.frame?.stress ?? 0) > 0.25;
    this.steam.visible = Boolean(cooler?.visible) && !this.reducedMotion && running && this.link !== 'offline';
    if (!this.steam.visible || !cooler) return;
    const dummy = new Object3D();
    const origin = cooler.position;
    for (let i = 0; i < 16; i += 1) {
      const fan = i % 4;
      const rise = ((time * 0.35 + i * 0.17) % 1);
      dummy.position.set(origin.x - 3.6 + fan * 2.4, origin.y + 2.8 + rise * 3.2, origin.z);
      dummy.scale.setScalar(0.6 + rise);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      this.steam.setMatrixAt(i, dummy.matrix);
    }
    this.steam.instanceMatrix.needsUpdate = true;
  }

  private updateScan(time: number): void {
    this.scene.traverse((object) => {
      const mesh = object as Mesh;
      const material = mesh.material;
      if (!material || Array.isArray(material)) return;
      const shader = material.userData.shader as { uniforms?: { uTime?: { value: number }; uScan?: { value: number } } } | undefined;
      if (!shader?.uniforms?.uTime || !shader.uniforms.uScan) return;
      shader.uniforms.uTime.value = this.reducedMotion ? 0 : time;
      shader.uniforms.uScan.value = material.userData.assetId === this.selected && !this.reducedMotion ? 1 : 0;
    });
  }

  private async loadArchiveTrees(): Promise<void> {
    try {
      const ktx2 = new KTX2Loader().setTranscoderPath('/decoders/basis/');
      ktx2.detectSupport(this.renderer);
      const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync('/models/plane-tree-v1-lod2.glb');
      gltf.scene.traverse((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        mesh.material = this.surfaces.leaf;
        mesh.castShadow = true;
      });
      const spots = DRESSING.filter((item) => item.kind === 'archive');
      for (const spot of spots) {
        const tree = gltf.scene.clone(true);
        tree.position.set(spot.x, 0, spot.z);
        tree.scale.setScalar(spot.scale);
        tree.userData.role = 'archive-tree';
        this.scene.add(tree);
      }
      ktx2.dispose();
      this.treeArchive = 'loaded';
    } catch (error) {
      console.warn('悬铃木模型未能载入，沿路保留参数化行道树', error);
      this.treeArchive = 'fallback';
    }
  }
}

function findAssetId(object: Object3D | null): string | null {
  let current: Object3D | null = object;
  while (current) {
    if (typeof current.userData.assetId === 'string') return current.userData.assetId;
    current = current.parent;
  }
  return null;
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

function resetDrop(array: Float32Array, index: number, randomHeight: boolean): void {
  const x = -10 + Math.random() * 96;
  const z = -40 + Math.random() * 90;
  const top = randomHeight ? Math.random() * 40 : 28 + Math.random() * 16;
  const length = 0.8 + Math.random() * 0.7;
  const base = index * 6;
  array[base] = x;
  array[base + 1] = top;
  array[base + 2] = z;
  array[base + 3] = x;
  array[base + 4] = top - length;
  array[base + 5] = z;
}
