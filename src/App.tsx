import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlantViewport, type ViewportApi } from './scene/PlantViewport.tsx';
import { connectTelemetry, postControl } from './net/client.ts';
import { ASSETS, assetById } from './sim/plant.ts';
import { DISCLAIMER, STALE_MS, type TelemetryFrame } from './sim/types.ts';
import { DEFAULT_WEATHER, weatherPreset, type FloorFilter, type LinkStatus, type QualityTier, type WeatherState } from './sim/view.ts';
import { BottomBar, LeftDock, RightDock, TopBar } from './ui/Hud.tsx';

export function App() {
  const api = useRef<ViewportApi>({ scene: null, onPick: () => undefined });
  const linkHandle = useRef<ReturnType<typeof connectTelemetry> | null>(null);
  const [frame, setFrame] = useState<TelemetryFrame | null>(null);
  const [link, setLink] = useState<LinkStatus>('connecting');
  const [selected, setSelected] = useState<string | null>(null);
  const [floor, setFloor] = useState<FloorFilter>('all');
  const [expanded, setExpanded] = useState(false);
  const [isolated, setIsolated] = useState(false);
  const [panel, setPanel] = useState<'overview' | 'detail' | 'weather'>('overview');
  const [weather, setWeather] = useState<WeatherState>(DEFAULT_WEATHER);
  const [quality, setQuality] = useState<QualityTier>('medium');
  const [query, setQuery] = useState('');
  const [trend, setTrend] = useState<Record<string, number[]>>({});
  const [load, setLoad] = useState(78);
  const [touring, setTouring] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [controlError, setControlError] = useState<string | null>(null);
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  const select = useCallback((id: string | null) => {
    setSelected(id);
    setPanel((current) => (current === 'weather' ? current : id ? 'detail' : 'overview'));
    api.current.scene?.setSelection(id);
  }, []);
  api.current.onPick = select;

  useEffect(() => {
    const handle = connectTelemetry({
      staleMs: STALE_MS,
      onStatus: setLink,
      onFrame: (next) => {
        setFrame(next);
        setLoad(Math.round(next.load * 100));
        setTrend((prev) => {
          const updated: Record<string, number[]> = {};
          for (const asset of ASSETS) {
            const value = next.assets[asset.id]?.temperature.value;
            if (value === undefined) continue;
            updated[asset.id] = [...(prev[asset.id] ?? []), value].slice(-40);
          }
          return updated;
        });
      },
    });
    linkHandle.current = handle;
    return () => handle.close();
  }, []);

  useEffect(() => {
    api.current.scene?.setFrame(frame, link);
  }, [frame, link]);

  useEffect(() => {
    api.current.scene?.setFloor(floor, expanded, isolated);
  }, [floor, expanded, isolated]);

  useEffect(() => {
    api.current.scene?.setWeather(weather);
  }, [weather]);

  useEffect(() => {
    api.current.scene?.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    api.current.scene?.setReducedMotion(reduced);
  }, [reduced]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.__TWIN__ = {
      diag: () => api.current.scene?.diagnostics() ?? null,
      link,
      seq: frame?.seq ?? null,
      frame,
    };
  });

  async function send(body: Record<string, unknown>, optimisticLoad?: number) {
    if (optimisticLoad !== undefined) setLoad(optimisticLoad);
    try {
      const next = await postControl(body);
      setFrame(next);
      setLoad(Math.round(next.load * 100));
      setControlError(null);
    } catch (error) {
      setControlError(error instanceof Error ? error.message : '模拟服务没有响应');
    }
  }

  const alarmCount = frame
    ? Object.values(frame.assets).filter((item) => item.status === 'alarm').length
    : 0;
  const warningCount = frame
    ? Object.values(frame.assets).filter((item) => item.status === 'warning').length
    : 0;

  return (
    <div className="app">
      <PlantViewport api={api} />
      <TopBar
        link={link}
        seq={frame?.seq ?? null}
        paused={frame?.paused ?? false}
        clock={clock}
        weather={weather}
        onDisconnect={() => linkHandle.current?.disconnect()}
        onReconnect={() => linkHandle.current?.reconnect()}
      />
      <LeftDock
        query={query}
        onQuery={setQuery}
        selected={selected}
        frame={frame}
        link={link}
        onSelect={select}
      />
      <RightDock
        panel={panel}
        onPanel={setPanel}
        selected={selected ? assetById(selected) : null}
        frame={frame}
        link={link}
        trend={selected ? trend[selected] ?? [] : []}
        load={load}
        weather={weather}
        quality={quality}
        floor={floor}
        expanded={expanded}
        isolated={isolated}
        touring={touring}
        alarmCount={alarmCount}
        warningCount={warningCount}
        controlError={controlError}
        onLoad={(value) => void send({ load: value / 100 }, value)}
        onFault={() => void send({ fault: 'cooling' })}
        onRecover={() => void send({ fault: 'none' })}
        onPause={() => void send({ paused: !(frame?.paused ?? false) })}
        onReset={() => void send({ reset: true })}
        onWeather={(mode) => setWeather((current) => weatherPreset(mode, current))}
        onRain={(rain) => setWeather((current) => ({ ...current, rain }))}
        onWind={(wind) => setWeather((current) => ({ ...current, wind }))}
        onToggle={(key, value) => setWeather((current) => ({ ...current, [key]: value }))}
        onNight={(night) => setWeather((current) => ({ ...current, night }))}
        onQuality={(next) => setQuality(next)}
        onFloor={(next) => setFloor(next)}
        onExpanded={() => setExpanded((value) => !value)}
        onIsolated={() => setIsolated((value) => !value)}
        onRestore={() => {
          setFloor('all');
          setExpanded(false);
          setIsolated(false);
          api.current.scene?.resetView();
          setTouring(false);
        }}
        onHome={() => {
          api.current.scene?.resetView();
          setTouring(false);
        }}
        onTop={() => {
          api.current.scene?.topView();
          setTouring(false);
        }}
        onTour={() => setTouring(api.current.scene?.toggleTour() ?? false)}
        onFocus={() => {
          if (selected) api.current.scene?.focus(selected);
        }}
      />
      <BottomBar selected={selected ? assetById(selected) : null} frame={frame} link={link} load={load} />
      <p className="disclaimer">{DISCLAIMER}</p>
    </div>
  );
}
