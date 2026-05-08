/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CESIUM_ION_TOKEN?: string
}

declare module '*.svg' {
  const component: string
  export default component
}
