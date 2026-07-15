import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// Versão exibida no "Sobre" das Configurações — é o que o usuário lê ao reportar
// um bug, então precisa apontar para um commit. O backend não serve versão: o
// /openapi.json está desativado em produção e o /health é genérico de propósito.
function resolveAppVersion(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? gitSha()
  return sha ? `${pkg.version} (${sha.slice(0, 7)})` : `${pkg.version} (dev)`
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

export default defineConfig({
  // define, e não process.env.VITE_APP_VERSION: a variante process.env depende da
  // ordem interna em que o Vite chama loadEnv após carregar este arquivo.
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(resolveAppVersion()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
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
  ],
})
