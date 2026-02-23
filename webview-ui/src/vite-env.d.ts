/// <reference types="vite/client" />

declare function acquireVsCodeApi(): VsCodeApi;

interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}
