/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_GAME_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv & {
    readonly BASE_URL: string;
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly MODE: string;
  };
}
