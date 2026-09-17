/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public OAuth client ids — safe to ship in the built JS; the matching
   *  secrets live only in the backend's own env. See frontend/.env.example. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GITHUB_CLIENT_ID?: string;
  /** The Telegram bot's public @username, not its token — the Login Widget
   *  script needs it to know which bot to authenticate against. */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
