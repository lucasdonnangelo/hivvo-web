import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import pkg from './package.json' with { type: 'json' }

// Sha curto do build, fonte única da versão do "Sobre" e do release do Sentry.
// Os dois PRECISAM sair daqui: se o release do init divergir do release do
// upload de source map, os eventos chegam sem símbolo.
const SHORT_SHA = (process.env.VERCEL_GIT_COMMIT_SHA ?? gitSha())?.slice(0, 7) ?? null

// Versão exibida no "Sobre" das Configurações — é o que o usuário lê ao reportar
// um bug, então precisa apontar para um commit. O backend não serve versão: o
// /openapi.json está desativado em produção e o /health é genérico de propósito.
function resolveAppVersion(): string {
  return SHORT_SHA ? `${pkg.version} (${SHORT_SHA})` : `${pkg.version} (dev)`
}

// Release do Sentry — mesmos dados do "Sobre", formato diferente de propósito:
// o release vira segmento de URL no Sentry, e "0.1.0 (abc1234)" viraria
// "0.1.0%20%28abc1234%29". Convenção do Sentry: nome@versao+build.
function resolveSentryRelease(): string {
  return SHORT_SHA ? `${pkg.name}@${pkg.version}+${SHORT_SHA}` : `${pkg.name}@${pkg.version}`
}

// production | preview — VERCEL_ENV existe no build da Vercel, mas o Vite só
// expõe ao client o que começa com VITE_, daí passar pelo define como o
// VITE_APP_VERSION. Fora da Vercel (build local) cai em development.
function resolveEnvironment(): string {
  return process.env.VERCEL_ENV ?? 'development'
}

function gitSha(): string | null {
  // Um build fora de um checkout git (tarball, container sem .git) não pode
  // quebrar por causa do rodapé do Sobre.
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

// O upload de source map só roda com credencial (Vercel). Sem token — build
// local, fork, CI sem secret — o plugin sai de cena e o build segue: mesma
// regra do DSN ausente ser no-op.
const sentryUploadEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
)

export default defineConfig({
  // define, e não process.env.VITE_APP_VERSION: a variante process.env depende da
  // ordem interna em que o Vite chama loadEnv após carregar este arquivo.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(resolveAppVersion()),
    'import.meta.env.VITE_SENTRY_RELEASE': JSON.stringify(resolveSentryRelease()),
    'import.meta.env.VITE_SENTRY_ENVIRONMENT': JSON.stringify(resolveEnvironment()),
  },
  build: {
    // Só gera mapa quando ele TEM para onde ir. Sem credencial de upload, o
    // .map ficaria no dist/ e seria servido pela Vercel em /assets/*.js.map —
    // URL adivinhável, código-fonte aberto. Não gerar é a única garantia que
    // não depende do upload dar certo.
    // 'hidden' = gera o .map SEM o comentário //# sourceMappingURL nos bundles:
    // o Sentry recebe o mapa no upload, mas nada no JS servido aponta para ele.
    // Some de vez com o filesToDeleteAfterUpload abaixo.
    sourcemap: sentryUploadEnabled ? 'hidden' : false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      // O workbox segue o build.sourcemap e passaria a emitir sw.js.map e
      // workbox-*.js.map. Esses não interessam ao Sentry (não são código do
      // app) e o filesToDeleteAfterUpload não os alcança — o workbox os gera
      // depois. Sem isso, seriam os únicos mapas servidos publicamente.
      workbox: { sourcemap: false },
      manifest: {
        name: 'Hivvo',
        short_name: 'Hivvo',
        description: 'Gestão financeira pessoal com IA',
        theme_color: '#1A1714',
        background_color: '#1A1714',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
    // Por último, como manda a doc do Sentry: precisa enxergar o bundle final.
    ...(sentryUploadEnabled
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: resolveSentryRelease() },
            telemetry: false,
            sourcemaps: {
              // Apaga os .map do dist DEPOIS do upload — o Sentry fica com os
              // símbolos e a Vercel não serve mapa nenhum publicamente.
              filesToDeleteAfterUpload: ['./dist/**/*.map'],
            },
          }),
        ]
      : []),
  ],
})
