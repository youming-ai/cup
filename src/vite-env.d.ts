/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the m3u8-extractor service. Defaults to http://localhost:3000 in dev. */
  readonly VITE_EXTRACTOR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
