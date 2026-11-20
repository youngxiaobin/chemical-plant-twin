import { memo, useEffect, useRef, useState } from 'react';
import { PlantScene } from './PlantScene.ts';
import { DEFAULT_WEATHER } from '../sim/view.ts';

export interface ViewportApi {
  scene: PlantScene | null;
  onPick: (id: string | null) => void;
}

function PlantViewportComponent({ api }: { api: { current: ViewportApi } }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let scene: PlantScene | null = null;
    try {
      scene = new PlantScene(element, DEFAULT_WEATHER, (id) => api.current.onPick(id), setError);
      api.current.scene = scene;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法创建三维场景');
      return;
    }
    return () => {
      scene?.dispose();
      if (api.current.scene === scene) api.current.scene = null;
    };
  }, [api]);

  return (
    <div className="viewport" ref={host} data-testid="canvas-host">
      {error ? (
        <div className="fallback" data-testid="webgl-fallback">
          <strong>三维画面不可用</strong>
          <p>{error}</p>
          <p>请使用支持 WebGL 的桌面浏览器打开本页。数据面板仍可连接本地模拟服务。</p>
        </div>
      ) : null}
    </div>
  );
}

export const PlantViewport = memo(PlantViewportComponent);
