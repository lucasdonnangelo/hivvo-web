import { defineConfig } from 'vitest/config'

// Config PRÓPRIA, e não um bloco `test` no vite.config.ts, porque ela substitui
// aquele arquivo inteiro na hora do teste: o vite.config carrega React, PWA e
// Sentry e roda `git rev-parse` para compor a versão do build — nada disso tem
// função ao exercitar uma função pura, e cada peça é uma chance de o teste
// quebrar por motivo que não é o teste.
//
// `environment: 'node'`: o que roda aqui não toca DOM. Quando entrar o primeiro
// teste de componente, ele pede jsdom — e aí a escolha é por arquivo
// (`// @vitest-environment jsdom`), não global.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
