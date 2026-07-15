/**
 * Observabilidade do front (Sentry) — espelho de app/core/observability.py.
 *
 * Regra dura de privacidade/LGPD, a mesma do backend: NUNCA enviar ao Sentry
 * valor/descrição de transação, conteúdo de chat, senha, token ou cookie — só
 * metadados. Um relatório de erro de app financeiro não pode conter o extrato
 * do usuário.
 *
 * A defesa é em três camadas, igual ao backend:
 *  1. no-op sem DSN (dev não precisa de Sentry e não pode crashar sem ele);
 *  2. cortar na ORIGEM (`sendDefaultPii: false`);
 *  3. `_beforeSend`/`_beforeBreadcrumb` como defesa adicional — refiltram o que
 *     a camada 2 já deveria ter cortado.
 *
 * O princípio de scrub é DENY-ALL onde não dá para saber o que é sensível (o
 * backend descarta `vars` de TODO frame pelo mesmo motivo) e allowlist onde dá.
 */
import * as Sentry from '@sentry/react'
import type { Breadcrumb, ErrorEvent } from '@sentry/react'

/** Headers que jamais podem ir ao Sentry — mesma lista do backend. */
const _SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-csrf-token'])

/**
 * Chaves cujo VALOR é dado financeiro, credencial ou conteúdo de chat.
 *
 * Casa por substring: cobre `valor`, `valor_total`, `nova_senha`, `senha_atual`
 * etc. sem precisar enumerar cada variação dos payloads.
 */
const _SENSITIVE_KEY_PATTERN =
  /(valor|descric|categor|forma_pagamento|parcela|mensagem|resposta|historico|senha|password|secret|token|authorization|cookie|email|nome_completo|cpf|cartao|fatura|saldo|limite)/i

/**
 * Chaves genéricas demais para casar por substring (`text` casaria com
 * `context`/`textAlign`). Só o nome exato é sensível.
 */
const _SENSITIVE_KEYS_EXACT = new Set(['text', 'data', 'body', 'payload', 'arguments', 'items'])

const _FILTERED = '[Filtered]'

function _isSensitiveKey(key: string): boolean {
  return _SENSITIVE_KEY_PATTERN.test(key) || _SENSITIVE_KEYS_EXACT.has(key.toLowerCase())
}

/**
 * Remove query string e fragmento de uma URL.
 *
 * Mesma decisão do middleware do backend, que loga `request.url.path` "sem query
 * string para não vazar segredos em URL". No front o alvo concreto é o
 * `?token=` do reset de senha: o ResetPasswordPage limpa a URL num effect, mas
 * um erro ANTES desse effect capturaria o token. Deny-all na query é mais barato
 * que enumerar quais params são seguros — perde-se `mes`/`ano` no debug, e tudo
 * bem.
 */
function _sanitizeUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : `${url.slice(0, cut)}?${_FILTERED}`
}

/**
 * Mascara recursivamente os valores de chaves sensíveis.
 *
 * Usado só em `extra`/`contexts`, onde contexto legítimo de debug convive com
 * dado financeiro — zerar tudo destruiria a utilidade do relatório. Nos demais
 * campos (breadcrumb de console, corpo do request, locals) o corte é deny-all.
 *
 * `seen` quebra ciclos; `depth` limita o custo em objetos grandes (o Sentry
 * normaliza em profundidade 3 de qualquer forma).
 */
function _maskSensitiveKeys(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value
  if (seen.has(value)) return value
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => _maskSensitiveKeys(item, depth + 1, seen))
  }

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = _isSensitiveKey(key) ? _FILTERED : _maskSensitiveKeys(item, depth + 1, seen)
  }
  return out
}

/**
 * Descarta as variáveis locais de todos os frames — porte direto do
 * `_scrub_frame_vars` do backend.
 *
 * O SDK do browser não envia `vars` hoje, mas o backend blinda pelo mesmo motivo
 * que vale aqui: se a captura de locals for reativada um dia, o payload da
 * transação viaja dentro deles e ninguém lembra deste arquivo.
 */
function _scrubFrameVars(stacktrace: unknown): void {
  if (!stacktrace || typeof stacktrace !== 'object') return
  const frames = (stacktrace as { frames?: unknown }).frames
  if (!Array.isArray(frames)) return
  for (const frame of frames) {
    if (frame && typeof frame === 'object') {
      delete (frame as Record<string, unknown>).vars
    }
  }
}

/**
 * Scrub de um breadcrumb. Retorna `null` para descartá-lo por completo.
 *
 * - `console`: DESCARTADO INTEIRO. A integração de console anexa os argumentos
 *   CRUS em `data.arguments`, e este app loga resposta de API no console
 *   (lib/unwrapList.ts) — ou seja, a lista de transações com valor e descrição
 *   iria junto do próximo erro. Mascarar não resolve: qualquer `console.log`
 *   futuro reintroduziria o vazamento em silêncio. Mesmo raciocínio do backend
 *   para os locals: não dá para saber o que é sensível, então descarta-se tudo.
 * - `fetch`/`xhr`: mantidos com ALLOWLIST (só method/url/status_code). O SDK não
 *   captura corpo hoje; a allowlist garante que continue assim se isso mudar.
 * - `navigation`: URLs de origem/destino sanitizadas.
 * - `ui.click`/`ui.input`: mantidos — carregam seletor CSS, não valor digitado.
 */
function _scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null

  if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
    const data = (breadcrumb.data ?? {}) as Record<string, unknown>
    breadcrumb.data = {
      method: data.method,
      url: _sanitizeUrl(data.url),
      status_code: data.status_code,
    }
    return breadcrumb
  }

  if (breadcrumb.category === 'navigation') {
    const data = (breadcrumb.data ?? {}) as Record<string, unknown>
    breadcrumb.data = { from: _sanitizeUrl(data.from), to: _sanitizeUrl(data.to) }
    return breadcrumb
  }

  return breadcrumb
}

function _beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  return _scrubBreadcrumb(breadcrumb)
}

/**
 * Remove dados sensíveis do evento (LGPD) — espelho do `_before_send` do backend.
 *
 * Defesa adicional sobre `sendDefaultPii: false` e sobre o `_beforeBreadcrumb`:
 * refiltra os breadcrumbs (um evento pode chegar com breadcrumbs anexados por
 * outro caminho), filtra headers, descarta cookies e corpo, varre os locals de
 * todo frame e mascara `extra`/`contexts`.
 */
function _beforeSend(event: ErrorEvent): ErrorEvent | null {
  const request = event.request
  if (request) {
    const headers = request.headers
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (_SENSITIVE_HEADERS.has(key.toLowerCase())) headers[key] = _FILTERED
      }
    }
    // `data` é o corpo do request (payload da transação); `cookies` é a sessão.
    delete request.cookies
    delete request.data
    delete request.query_string
    if (request.url) request.url = _sanitizeUrl(request.url)
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((breadcrumb) => _scrubBreadcrumb(breadcrumb))
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null)
  }

  for (const value of event.exception?.values ?? []) {
    _scrubFrameVars(value.stacktrace)
  }
  for (const value of event.threads?.values ?? []) {
    _scrubFrameVars(value.stacktrace)
  }

  // `__serialized__` é onde o SDK despeja um objeto cru passado a
  // captureException(obj) — captureException(transacao) cairia aqui inteiro.
  if (event.extra) {
    delete event.extra.__serialized__
    event.extra = _maskSensitiveKeys(event.extra) as typeof event.extra
  }
  if (event.contexts) {
    event.contexts = _maskSensitiveKeys(event.contexts) as typeof event.contexts
  }

  // Nunca chamamos setUser; com sendDefaultPii=false o SDK também não preenche
  // ip_address. Blindado assim mesmo, pelo mesmo motivo dos locals.
  if (event.user) {
    delete event.user.ip_address
    delete event.user.email
    delete event.user.username
  }

  return event
}

/**
 * Inicializa o Sentry SOMENTE se VITE_SENTRY_DSN estiver setada.
 *
 * Sem DSN é no-op (dev não crasha) — mesma regra do `init_sentry()` do backend.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT,
    release: import.meta.env.VITE_SENTRY_RELEASE,
    // LGPD — cortar na ORIGEM, antes do beforeSend:
    sendDefaultPii: false, // não coletar PII automaticamente (ip, cookies, headers)
    beforeSend: _beforeSend, // defesa adicional (scrub explícito)
    beforeBreadcrumb: _beforeBreadcrumb, // descarta console, allowlist em rede
  })
}
