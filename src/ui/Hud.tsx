import { ASSETS, neighborIds, type AssetDef } from '../sim/plant.ts';
import type { TelemetryFrame } from '../sim/types.ts';
import type { FloorFilter, LinkStatus, QualityTier, WeatherMode, WeatherState } from '../sim/view.ts';
import { linkText, num, statusText, trendPath } from './format.ts';

export function TopBar(props: {
  link: LinkStatus;
  seq: number | null;
  paused: boolean;
  clock: Date;
  weather: WeatherState;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const weatherName = props.weather.night ? '夜间' : props.weather.mode === 'storm' ? '暴雨' : props.weather.mode === 'rain' ? '小雨' : '晴';
  return (
    <header className="topbar">
      <div className="brand">
        <span className="mark" aria-hidden="true" />
        <div>
          <h1>化工厂数字孪生</h1>
          <p>本地示意装置 · 非现场数据</p>
        </div>
      </div>
      <div className="sim-pill" data-testid="sim-badge">模拟数据</div>
      <div className="top-meta">
        <button className={`link-chip ${props.link}`} data-testid="link-status" onClick={props.link === 'offline' ? props.onReconnect : props.onDisconnect}>
          <i />
          {linkText(props.link)}
          {props.paused ? ' · 已暂停' : ''}
        </button>
        <span data-testid="sample-seq">采样 {props.seq ?? '—'}</span>
        <span>{weatherName} {Math.round(18 + props.weather.rain * 4)}°C</span>
        <time>{props.clock.toLocaleTimeString('zh-CN', { hour12: false })}</time>
        <button className="text-button" data-testid="disconnect-button" onClick={props.onDisconnect}>断开</button>
        <button className="text-button" data-testid="reconnect-button" onClick={props.onReconnect}>重连</button>
      </div>
    </header>
  );
}

export function LeftDock(props: {
  query: string;
  onQuery: (value: string) => void;
  selected: string | null;
  frame: TelemetryFrame | null;
  link: LinkStatus;
  onSelect: (id: string | null) => void;
}) {
  const needle = props.query.trim().toLowerCase();
  const groups = [...new Set(ASSETS.map((asset) => asset.group))];
  return (
    <aside className="dock left-dock">
      <div className="dock-head">
        <h2>园区设备</h2>
        <p>列表与模型双向选择</p>
      </div>
      <input
        className="search"
        placeholder="搜索名称或位号"
        value={props.query}
        onChange={(event) => props.onQuery(event.target.value)}
        aria-label="搜索设备"
      />
      <button className={`overview-button ${props.selected ? '' : 'active'}`} data-testid="overview-button" onClick={() => props.onSelect(null)}>
        全厂总览
        <em>{ASSETS.length} 台</em>
      </button>
      <div className="asset-list" data-testid="asset-list">
        {groups.map((group) => {
          const items = ASSETS.filter((asset) => asset.group === group && (!needle || `${asset.id} ${asset.name}`.toLowerCase().includes(needle)));
          if (!items.length) return null;
          return (
            <section key={group}>
              <h3>{group}</h3>
              {items.map((asset) => {
                const reading = props.frame?.assets[asset.id];
                const label = reading ? statusText(reading.status, props.link) : '等待';
                return (
                  <button
                    key={asset.id}
                    className={`asset-row ${props.selected === asset.id ? 'active' : ''} ${label === '已过期' ? 'stale' : reading?.status ?? ''}`}
                    data-testid={`asset-${asset.id}`}
                    onClick={() => props.onSelect(asset.id)}
                  >
                    <span>
                      <b>{asset.id}</b>
                      {asset.name}
                    </span>
                    <em>{label}</em>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

export function RightDock(props: {
  panel: 'overview' | 'detail' | 'weather';
  onPanel: (panel: 'overview' | 'detail' | 'weather') => void;
  selected: AssetDef | null;
  frame: TelemetryFrame | null;
  link: LinkStatus;
  trend: number[];
  load: number;
  weather: WeatherState;
  quality: QualityTier;
  floor: FloorFilter;
  expanded: boolean;
  isolated: boolean;
  touring: boolean;
  alarmCount: number;
  warningCount: number;
  controlError: string | null;
  onLoad: (value: number) => void;
  onFault: () => void;
  onRecover: () => void;
  onPause: () => void;
  onReset: () => void;
  onWeather: (mode: WeatherMode) => void;
  onRain: (value: number) => void;
  onWind: (value: number) => void;
  onToggle: (key: 'particles' | 'puddles' | 'fog' | 'wet' | 'vane' | 'lightning', value: boolean) => void;
  onNight: (night: boolean) => void;
  onQuality: (quality: QualityTier) => void;
  onFloor: (floor: FloorFilter) => void;
  onExpanded: () => void;
  onIsolated: () => void;
  onRestore: () => void;
  onHome: () => void;
  onTop: () => void;
  onTour: () => void;
  onFocus: () => void;
}) {
  return (
    <aside className="dock right-dock" data-testid="panel-mode" data-panel={props.panel}>
      <div className="panel-switch">
        <button className={props.panel === 'overview' ? 'active' : ''} onClick={() => props.onPanel('overview')}>运行总览</button>
        <button className={props.panel === 'detail' ? 'active' : ''} onClick={() => props.onPanel('detail')} disabled={!props.selected}>设备详情</button>
        <button className={props.panel === 'weather' ? 'active' : ''} data-testid="open-weather" onClick={() => props.onPanel('weather')}>天气</button>
      </div>
      {props.panel === 'detail' && props.selected ? (
        <Detail {...props} selected={props.selected} />
      ) : null}
      {props.panel === 'weather' ? <WeatherPanel {...props} /> : null}
      {props.panel === 'overview' || (props.panel === 'detail' && !props.selected) ? <Overview {...props} /> : null}
    </aside>
  );
}

function Overview(props: {
  frame: TelemetryFrame | null;
  load: number;
  alarmCount: number;
  warningCount: number;
  floor: FloorFilter;
  expanded: boolean;
  isolated: boolean;
  touring: boolean;
  quality: QualityTier;
  controlError: string | null;
  onLoad: (value: number) => void;
  onFault: () => void;
  onRecover: () => void;
  onPause: () => void;
  onReset: () => void;
  onFloor: (floor: FloorFilter) => void;
  onExpanded: () => void;
  onIsolated: () => void;
  onRestore: () => void;
  onHome: () => void;
  onTop: () => void;
  onTour: () => void;
  onQuality: (quality: QualityTier) => void;
  onPanel: (panel: 'overview' | 'detail' | 'weather') => void;
}) {
  return (
    <div className="panel-body">
      <h2>运行总览</h2>
      <p className="hint">全厂负荷只改变本地模拟，不连接控制系统。</p>
      <label className="slider-label">全厂负荷 <b data-testid="load-readout">{props.load}%</b></label>
      <input data-testid="load-slider" type="range" min={0} max={100} value={props.load} onChange={(event) => props.onLoad(Number(event.target.value))} />
      <div className="stat-grid">
        <div><span>告警</span><b>{props.alarmCount}</b></div>
        <div><span>预警</span><b>{props.warningCount}</b></div>
        <div><span>回路</span><b>{props.frame?.fault === 'cooling' ? '冷却故障' : '演练关闭'}</b></div>
      </div>
      <h3>视角</h3>
      <div className="button-row">
        <button data-testid="view-home" onClick={props.onHome}>全厂</button>
        <button data-testid="view-top" onClick={props.onTop}>俯视</button>
        <button data-testid="view-tour" onClick={props.onTour}>{props.touring ? '停止巡检' : '开始巡检'}</button>
        <button data-testid="view-reset" onClick={props.onHome}>复位</button>
      </div>
      <h3>楼层</h3>
      <div className="button-row">
        <button data-testid="floor-all" className={props.floor === 'all' ? 'active' : ''} onClick={() => props.onFloor('all')}>全部</button>
        <button data-testid="floor-0" className={props.floor === 0 ? 'active' : ''} onClick={() => props.onFloor(0)}>L1</button>
        <button data-testid="floor-1" className={props.floor === 1 ? 'active' : ''} onClick={() => props.onFloor(1)}>L2</button>
        <button data-testid="floor-2" className={props.floor === 2 ? 'active' : ''} onClick={() => props.onFloor(2)}>L3</button>
      </div>
      <div className="button-row">
        <button data-testid="expand-button" className={props.expanded ? 'active' : ''} onClick={props.onExpanded}>{props.expanded ? '合并楼层' : '展开楼层'}</button>
        <button data-testid="isolate-button" className={props.isolated ? 'active' : ''} onClick={props.onIsolated}>{props.isolated ? '取消隔离' : '隔离选中'}</button>
        <button data-testid="restore-button" onClick={props.onRestore}>还原</button>
      </div>
      <h3>演练</h3>
      <div className="button-row">
        <button className="warn" data-testid="fault-button" onClick={props.onFault}>故障演练</button>
        <button data-testid="recover-button" onClick={props.onRecover}>恢复</button>
        <button data-testid="pause-button" onClick={props.onPause}>{props.frame?.paused ? '继续' : '暂停'}</button>
        <button data-testid="reset-button" onClick={props.onReset}>重置</button>
      </div>
      <label className="slider-label">画质
        <select data-testid="quality-select" value={props.quality} onChange={(event) => props.onQuality(event.target.value as QualityTier)}>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高 · 含水池反射</option>
        </select>
      </label>
      {props.controlError ? <p className="error">{props.controlError}</p> : null}
      <button className="weather-jump" onClick={() => props.onPanel('weather')}>打开天气效果</button>
    </div>
  );
}

function Detail(props: {
  selected: AssetDef;
  frame: TelemetryFrame | null;
  link: LinkStatus;
  trend: number[];
  load: number;
  controlError: string | null;
  onLoad: (value: number) => void;
  onFault: () => void;
  onRecover: () => void;
  onFocus: () => void;
}) {
  const reading = props.frame?.assets[props.selected.id];
  const stale = props.link === 'stale' || props.link === 'offline';
  const path = trendPath(props.trend, 248, 72);
  return (
    <div className="panel-body">
      <h2 data-testid="selected-name">{props.selected.id} {props.selected.name}</h2>
      <p className="hint">{props.selected.tutorialAnalog} · {props.selected.levelLabel}</p>
      <div className="chips">
        <span className={stale ? 'stale' : reading?.status ?? ''}>{reading ? statusText(reading.status, props.link) : '等待采样'}</span>
        {props.frame?.fault === 'cooling' && ['CW-301', 'T-102', 'V-301'].includes(props.selected.id) ? <span className="alarm">冷却故障影响</span> : null}
      </div>
      {reading ? (
        <>
          <p className="hero-metric" data-testid="metric-temp">{num(reading.temperature.value, 1)}<small>{reading.temperature.unit}</small></p>
          <MetricLine testId="metric-pressure" label="压力" value={num(reading.pressure.value, 3)} unit={reading.pressure.unit} low={reading.pressure.low} high={reading.pressure.high} />
          <MetricLine testId="metric-flow" label="流量" value={num(reading.flow.value, 1)} unit={reading.flow.unit} low={reading.flow.low} high={reading.flow.high} />
          <MetricLine testId="metric-level" label={props.selected.levelLabel} value={num(reading.level.value, 1)} unit={reading.level.unit} low={reading.level.low} high={reading.level.high} />
        </>
      ) : <p className="hint">尚未收到采样。</p>}
      <h3>短趋势 · 最近 {props.trend.length} 次温度采样</h3>
      <svg className="trend" data-testid="trend-svg" viewBox="0 0 248 72" role="img" aria-label="温度短趋势">
        <path d={path} />
      </svg>
      <label className="slider-label">负荷调节 <b>{props.load}%</b></label>
      <input data-testid="detail-load-slider" type="range" min={0} max={100} value={props.load} onChange={(event) => props.onLoad(Number(event.target.value))} />
      <div className="button-row">
        <button className="warn" onClick={props.onFault}>故障演练</button>
        <button onClick={props.onRecover}>恢复</button>
        <button onClick={props.onFocus}>定位</button>
      </div>
      <h3>关联设备</h3>
      <div className="chips">
        {neighborIds(props.selected.id).map((id) => <span key={id}>{id}</span>)}
      </div>
      {stale ? <div className="stale-card" data-testid="stale-card">链路不是实时状态。上面的数值是最后一次采样，流动动画已停住。</div> : null}
      {props.controlError ? <p className="error">{props.controlError}</p> : null}
    </div>
  );
}

function MetricLine(props: { testId: string; label: string; value: string; unit: string; low: number; high: number }) {
  return (
    <div className="metric-line" data-testid={props.testId}>
      <span>{props.label}</span>
      <b>{props.value} <small>{props.unit}</small></b>
      <em>示意范围 {props.low}–{props.high}</em>
    </div>
  );
}

function WeatherPanel(props: {
  weather: WeatherState;
  onWeather: (mode: WeatherMode) => void;
  onRain: (value: number) => void;
  onWind: (value: number) => void;
  onToggle: (key: 'particles' | 'puddles' | 'fog' | 'wet' | 'vane' | 'lightning', value: boolean) => void;
  onNight: (night: boolean) => void;
}) {
  const toggles: Array<{ key: 'particles' | 'puddles' | 'fog' | 'wet' | 'vane' | 'lightning'; label: string; testId: string }> = [
    { key: 'particles', label: '雨滴粒子', testId: 'toggle-rain' },
    { key: 'puddles', label: '地面积水', testId: 'toggle-puddles' },
    { key: 'fog', label: '雾效', testId: 'toggle-fog' },
    { key: 'wet', label: '湿润材质', testId: 'toggle-wet' },
    { key: 'vane', label: '风向指示', testId: 'toggle-wind' },
    { key: 'lightning', label: '闪电氛围', testId: 'toggle-lightning' },
  ];
  return (
    <div className="panel-body">
      <h2>天气效果</h2>
      <p className="hint">只改变画面。不改变工艺读数，也不代表真实气象。</p>
      <div className="button-row">
        <button data-testid="weather-clear" className={props.weather.mode === 'clear' ? 'active' : ''} onClick={() => props.onWeather('clear')}>晴</button>
        <button data-testid="weather-rain" className={props.weather.mode === 'rain' ? 'active' : ''} onClick={() => props.onWeather('rain')}>雨</button>
        <button data-testid="weather-storm" className={props.weather.mode === 'storm' ? 'active' : ''} onClick={() => props.onWeather('storm')}>暴雨</button>
      </div>
      <div className="button-row">
        <button data-testid="day-night" className={props.weather.night ? 'active' : ''} onClick={() => props.onNight(!props.weather.night)}>{props.weather.night ? '切回日间' : '切换夜间'}</button>
      </div>
      <label className="slider-label">雨强 <b>{Math.round(props.weather.rain * 100)}%</b></label>
      <input data-testid="rain-slider" type="range" min={0} max={100} value={Math.round(props.weather.rain * 100)} onChange={(event) => props.onRain(Number(event.target.value) / 100)} />
      <label className="slider-label">风力 <b>{Math.round(props.weather.wind * 100)}%</b></label>
      <input data-testid="wind-slider" type="range" min={0} max={100} value={Math.round(props.weather.wind * 100)} onChange={(event) => props.onWind(Number(event.target.value) / 100)} />
      {toggles.map((item) => (
        <label key={item.key} className="toggle">
          <span>{item.label}</span>
          <input data-testid={item.testId} type="checkbox" checked={props.weather[item.key]} onChange={(event) => props.onToggle(item.key, event.target.checked)} />
        </label>
      ))}
    </div>
  );
}

export function BottomBar(props: {
  selected: AssetDef | null;
  frame: TelemetryFrame | null;
  link: LinkStatus;
  load: number;
}) {
  const reading = props.selected ? props.frame?.assets[props.selected.id] : null;
  const readings = props.frame ? Object.values(props.frame.assets) : [];
  const average = readings.length ? readings.reduce((sum, item) => sum + item.temperature.value, 0) / readings.length : null;
  const pressure = readings.length ? readings.reduce((sum, item) => sum + item.pressure.value, 0) / readings.length : null;
  const feed = props.frame?.assets['P-401']?.flow.value;
  return (
    <footer className="bottombar">
      <div>
        <span>{props.selected ? '选中设备' : '全厂总览'}</span>
        <strong data-testid="bottom-name">{props.selected ? `${props.selected.id} ${props.selected.name}` : '全部设备'}</strong>
      </div>
      <Metric label={reading ? '温度' : '均温'} value={reading ? num(reading.temperature.value, 1) : average === null ? '—' : num(average, 1)} unit="°C" />
      <Metric label={reading ? '压力' : '均压'} value={reading ? num(reading.pressure.value, 3) : pressure === null ? '—' : num(pressure, 3)} unit="MPa" />
      <Metric label={reading ? '流量' : '进料'} value={reading ? num(reading.flow.value, 1) : feed === undefined ? '—' : num(feed, 1)} unit="m³/h" />
      <Metric label="负荷" value={String(props.load)} unit="%" />
      <div className="bottom-note">{props.link === 'live' && !props.frame?.paused ? '数值来自本地模拟' : '数值为最后已知采样'}</div>
    </footer>
  );
}

function Metric(props: { label: string; value: string; unit: string }) {
  return (
    <div className="bottom-metric">
      <span>{props.label}</span>
      <strong>{props.value}<small>{props.unit}</small></strong>
    </div>
  );
}
