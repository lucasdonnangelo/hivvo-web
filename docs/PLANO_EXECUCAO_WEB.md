# Plano de Execução — hivvo-web

Roteiro de correções, em ordem de execução, fundindo `docs/AUDITORIA_FRONTEND.md` (FE-xx) e o log de observações do Claude Chrome (renderizado).

Cada batch é um prompt para o Claude Code na pasta `hivvo-web`. Detalhes de cada achado (arquivo:linha, recomendação) estão em `AUDITORIA_FRONTEND.md` — os prompts referenciam por ID.

---

## Como usar

- Execute **um batch por vez**, na ordem. Traga o resultado para revisão antes de avançar.
- Regra-padrão de cada prompt: ler `Hivvo_Referencia.md`, `SESSAO_ATUAL.md` e `AUDITORIA_FRONTEND.md`; mostrar plano antes; implementar só o listado; `npm run build` deve passar ao fim; atualizar `SESSAO_ATUAL.md`; aguardar aprovação antes do commit.

### Gates e dependências

1. **Web-Batch 1 primeiro** — o build está quebrado (FE-01); sem ele não há como validar nada nem fazer deploy.
2. **Batches cross-repo (3, 4, 5)** precisam de uma decisão/checagem no backend antes do fix — estão marcados. O endpoint de sugestão (Batch 4) e as investigações de categoria (Batch 3) e de mês da fatura (Batch 5) tocam o hivvo-api.
3. **Deploy** depende da decisão de topologia (compartilhada com o backend: `app.hivvo.app` / `api.hivvo.app`).
4. Validação assistida pelo **Claude Chrome** (testador) ao fim de cada batch — você é o validador final.

---

# PRÉ-DEPLOY

## Web-Batch 1 — Desbloquear build + higiene crítica

```
[regra-padrão]

- FE-01 (Crítico): corrigir os 2 erros de build em AssistantPage.tsx — remover o import morto `clearHistorico` (TS6133) e tipar o estado da sessão explicitamente (`useState<string>(...)`) (TS2345). Confirmar `npm run build` verde. Adicionar `npm run build` a um check de pre-push/CI para impedir regressão.
- FE-06: em build de produção (`import.meta.env.PROD`), lançar erro explícito se `VITE_API_URL` estiver ausente (em vez do fallback silencioso para localhost).
- FE-03: `npm update react-router-dom` para 6.30.4 (corrige a vuln de open redirect).
- FE-20: os botões "Exportar" sem implementação (CardsPage handleExport = console.log; SummaryPage placeholder) — ocultar por enquanto (registrar export PDF/relatório como pós-launch) OU implementar.
```

## Web-Batch 2 — Headers de produção + token de reset

```
[regra-padrão]

- FE-02: criar vercel.json com headers — CSP restritiva (`default-src 'self'`; `connect-src 'self' https://<api>`; `style-src`/`font-src` para Google Fonts, ou self-hostar a Inter e eliminar o terceiro), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Permissions-Policy` mínima.
- FE-04: em ResetPasswordPage, capturar o token em estado e removê-lo da URL com `window.history.replaceState` no mount (combina com o Referrer-Policy acima). Cruza com F-25 do backend.
```

## Web-Batch 3 — Cluster de categorias (CROSS-REPO — investigar antes de corrigir)

```
[regra-padrão]

Investigar a raiz compartilhada antes de corrigir. Sintomas (Chrome): categoria "Outros" duplicada (mesmo id → key collision no React, ~500 erros + tiles repetidas); categorias padrão com botão de excluir (✕) — regressão do fix f55c4df; categorias de receita selecionáveis com Tipo = Despesa.

- Verificar PRIMEIRO no hivvo-api: `GET /categories` está devolvendo "Outros" duplicado? As categorias padrão vêm com `usuario_id = null` corretamente? (Se a duplicata ou a flag vier do backend, abrir tarefa no plano do hivvo-api — ver nota cross-repo.)
- Frontend: garantir key estável e única na lista de categorias (dedupe por id); restaurar/corrigir a guarda que esconde o ✕ das categorias padrão (`usuario_id !== null`); filtrar as categorias por tipo (receita vs despesa) no grid de Adicionar.
```

## Web-Batch 4 — Endpoint dedicado de sugestão de categoria (CROSS-REPO — resolve FE-08)

```
[regra-padrão]

Causa-raiz do mistério do histórico do Assistente. Hoje a sugestão de categoria reutiliza POST /ai/chat, que persiste no chat_messages e polui a memória/sessões.

- hivvo-api (cross-repo, abrir tarefa no plano do backend): criar endpoint dedicado de sugestão (ex.: POST /ai/suggest-category) que chama o Gemini SEM persistir em chat_messages e sem entrar na janela de 50 mensagens.
- hivvo-web: criar service próprio para esse endpoint (não reusar sendMessage); AddTransactionPage passa a usá-lo. Disparar a sugestão preferencialmente no blur do campo (reduz custo/ruído).
- FE-19 (de carona, mesmo código): guarda `let active = true` no useEffect do debounce para evitar race condition de sugestão obsoleta.
```

## Web-Batch 5 — Barra de limite no mês errado (CROSS-REPO — investigar)

```
[regra-padrão]

Sintoma (Chrome): a barra "R$ X usado" do cartão mostra o total da fatura do mês ERRADO (exibiu o total de Julho com mês corrente Junho).

- Investigar se a origem é o backend (`fatura_aberta_total`/cálculo do mês da fatura aberta em cards.py — off-by-one) ou o frontend (rótulo/mês de referência no CardVisual). Corrigir no lado correto. Se for backend, abrir tarefa no plano do hivvo-api (cross-repo).
```

## Web-Batch 6 — TypeScript strict + contrato de API

```
[regra-padrão]

- FE-09: habilitar `"strict": true` no tsconfig e corrigir os erros resultantes (esforço único enquanto a base é pequena). Atenção a null-checks em `user?.username?.[0]` e nos `parseFloat` de campos do backend.
- FE-10: criar um unwrap central por service (`unwrapList<T>(data): T[]` que aceita array nu OU envelope `{items,total}`) ANTES da migração do backend para `/api/v1` + paginação, permitindo transição sem big-bang. Idealmente validar respostas dos services financeiros com schemas Zod (lib já no projeto). Confirmar que o `/api/v1` entra só via `VITE_API_URL` (paths dos services são relativos). Cruza com Batches 4 e 8 do plano do backend.
```

## Web-Batch 7 — Performance de carregamento

```
[regra-padrão]

- FE-11: code splitting por rota com `React.lazy` + `Suspense` (Summary, Assistant, Import e Cards isolam recharts e react-markdown — maiores ganhos). Opcional: `manualChunks` para vendor split. Meta: reduzir o bundle único de ~1.014 kB.
```

---

## → DEPLOY (Vercel)

- Configurar `VITE_API_URL` para o backend de produção (incluindo `/api/v1` quando o backend migrar).
- Confirmar os headers do `vercel.json` ativos e PWA instalável.
- **Coordenar a topologia com o backend:** `app.hivvo.app` (Vercel) + `api.hivvo.app` (Railway), cookie `Domain=.hivvo.app`. Sem isso o app carrega mas não autentica (cookie cross-site).
- Validar no build de produção: service worker registrado, sem versão zumbi (`autoUpdate`).

---

# PÓS-DEPLOY

## Web-Batch 8 — Robustez de dados e rede

```
[regra-padrão]

- FE-12: invalidação de cache TanStack ampla nas mutações de transação — `['installments']`, `['invoices']`, `['invoice-detail']`, `['cards']`, `['statistics']` (hoje só invalida transactions + statistics/monthly).
- FE-13: normalizar `forma_pagamento` do CSV para o vocabulário canônico (mapa `pix → PIX` etc.) usando a mesma constante compartilhada; considerar parser com suporte a aspas (papaparse) ou documentar o template como única forma suportada.
- FE-05: no interceptor, ignorar URLs de auth público (`/auth/login|register|forgot-password|reset-password`) e marcar `originalRequest._retry = true` antes do retry.
```

## Web-Batch 9 — Acessibilidade

```
[regra-padrão]

- FE-21: `Modal` com `role="dialog"`/`aria-modal`, focus trap, foco inicial e devolução de foco; substituir o modal custom do Assistente pelo componente compartilhado.
- FE-22: componente `ErrorState` reutilizável aplicado a Summary, Cards e Assistant; no histórico do chat, distinguir vazio de erro (toast).
- FE-23: alvos de toque ≥ 44px nas ações de editar/excluir transação, fechar modal e avatar (ex.: `w-10 h-10 -m-1.5`).
- FE-24: clarear o token `text-muted` (~`#9A968F`) para ≥ 4,5:1 sobre surface, ou usar `text-primary` em captions sobre surface.
- FE-25: `role="status"`/`aria-live` no Toast (erros `role="alert"`); pausar timer no hover.
- FE-27: nome acessível em campos de busca/chat (`aria-label`), campo Nome (`htmlFor`/`id`), grupos de botões (`role="radiogroup"`/`group` + `aria-label`).
- FE-26: splash mínimo (logo + spinner) durante a init de auth em vez de `return null`.
```

## Web-Batch 10 — Consistência e dívida técnica

```
[regra-padrão]

- FE-14: remover código morto (App.css com media queries, useAuth, partes de uiStore, deleteCard, refreshToken exportado, invoiceMeta, _prevQ).
- FE-15: criar `src/lib/format.ts` (formatBRL, formatVariacao, datas) e `src/lib/constants.ts` (MONTHS, FORMAS_PAGAMENTO); extrair `MetricCard` e `extractDetail` para reuso.
- FE-17: paleta numa fonte de verdade — `tailwind.config.ts` consumindo as variáveis de `tokens.css`; `index.css` com `@apply`.
- FE-28: adicionar `variant="danger-solid"` ao Button e usar nos modais destrutivos (eliminar o override `!bg-danger`).
- FE-29: nos modais com formulário "sujo" (`isDirty`), confirmar antes de descartar por overlay/ESC.
- FE-16: ao ativar strict, considerar `valor: z.string()` + transform no schema (elimina o cast `'' as unknown as number`).
- FE-18: documentar a exceção do histórico do chat em useState OU migrar para `useQuery(['ai','historico'])` + `setQueryData`.
- FE-07: documentar a restrição do service worker (nunca cachear `/auth/*` e `/ai/*` se um dia houver runtime caching).
- Menores (Chrome): `/auth/me` chamado 2x no boot; rótulo "Março 2026" estranho no card de parcelas da visão Ano; flash branco ao navegar para /import; warnings de future-flag do React Router.
```

---

# Notas cross-repo (abrir tarefas no PLANO_EXECUCAO_API.md)

- **FE-08:** novo endpoint de sugestão sem persistência no backend (Web-Batch 4).
- **Cluster de categorias:** checar `GET /categories` (duplicata de "Outros"? `usuario_id=null` nas padrão?) (Web-Batch 3).
- **Barra de limite:** possível off-by-one em `fatura_aberta_total`/mês da fatura aberta (Web-Batch 5).
- **`/api/v1` + envelope de paginação:** alinhar com Batches 4 e 8 do backend (Web-Batch 6).
- **Token de reset:** FE-04 (replaceState) + F-25 do backend (fragmento/POST).

# Desescalações (o frontend já protege o usuário — backend mantém como defesa em profundidade, no plano do API)

- **T-40** (cartão com dia inválido): o frontend valida e bloqueia (Chrome confirmou). Backend ainda deve validar (clientes fora da UI) — segue no plano do API, urgência de UX reduzida.
- **T-35** (editar parcelada dessincroniza): o frontend já bloqueia a edição (read-only + "Gerenciar Parcelas"). Backend mantém validação como defesa.
- **T-36** (poluição de fatura entre usuários): não reproduzível em uso normal; furo de escrita no backend, segue no plano do API.
