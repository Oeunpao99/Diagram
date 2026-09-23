/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public OAuth client ids — safe to ship in the built JS; the matching
   *  secrets live only in the backend's own env. See frontend/.env.example. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GITHUB_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
