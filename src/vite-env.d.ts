/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Injetada em build-time pelo define do vite.config — nunca vem de .env. */
  readonly VITE_APP_VERSION: string
  /** Ausente = Sentry no-op (dev). Setada no painel da Vercel. */
  readonly VITE_SENTRY_DSN?: string
  /** Injetadas em build-time pelo define do vite.config — nunca vêm de .env. */
  readonly VITE_SENTRY_RELEASE: string
  readonly VITE_SENTRY_ENVIRONMENT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
