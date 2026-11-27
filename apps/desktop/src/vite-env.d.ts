/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Folder name under packs/ for the companion, e.g. "xiangling". Defaults to "default". */
  readonly VITE_COMPANION_PACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
