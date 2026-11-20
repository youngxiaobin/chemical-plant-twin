/// <reference types="vite/client" />

declare module '*.glsl?raw' {
  const source: string;
  export default source;
}

interface TwinDebug {
  diag: () => unknown;
  link: string;
  seq: number | null;
  frame: unknown;
}

interface Window {
  __TWIN__?: TwinDebug;
}
