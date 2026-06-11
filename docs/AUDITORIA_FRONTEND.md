# Auditoria de Código — hivvo-web (Frontend)

**Data:** 11 de junho de 2026
**Escopo:** Segurança (cliente), Técnica/Qualidade, UX/Acessibilidade
**Método:** leitura integral de `src/` (52 arquivos), configs (Vite, Tailwind, TS, PWA), `npm audit`, `tsc -b` e `vite build` para evidência de compilação/bundle. Nenhum arquivo de código foi alterado.
**Referências cruzadas:** auditoria do backend (F-25 reset de senha; migração futura `/api/v1`; envelope paginado nas listagens).

---

## Resumo executivo

O frontend está em bom estado estrutural: as regras arquiteturais do projeto são amplamente cumpridas (layouts duplos sem media query, tokens de cor, TanStack vs Zustand, um service por domínio), **o JWT não toca localStorage/sessionStorage** (cookie httpOnly + `withCredentials`), não há nenhum sink de XSS (`dangerouslySetInnerHTML`/`innerHTML` ausentes; o markdown do Assistente usa `react-markdown` sem `rehype-raw`, que não renderiza HTML) e o service worker não cacheia respostas da API.

Há, porém, **dois bloqueadores de deploy**: o **build está quebrado** (`npm run build` falha com 2 erros de TypeScript em `AssistantPage.tsx` — o deploy na Vercel falharia hoje) e **a sugestão de categoria por IA polui o histórico persistente do chat** (cada tecla digitada na descrição de uma transação vira mensagem salva no banco via `POST /ai/chat`, contamina a memória de 50 mensagens da IA e pode aparecer como "sessão mais recente" no chat). Além disso, faltam headers de segurança para produção (CSP/Referrer-Policy via `vercel.json`), o `react-router-dom` tem vulnerabilidade moderada conhecida com fix disponível, e o `strict` do TypeScript está desligado — o que enfraquece exatamente a proteção que o projeto precisará quando o backend migrar para o envelope paginado.

| Severidade | Qtde |
|---|---|
| Crítico | 1 |
| Alto | 3 |
| Médio | 11 |
| Baixo | 14 |

---

## Seção 1 — Segurança (cliente)

### FE-01 [SEGURANÇA] [Crítico] [ANTES DO DEPLOY] — Build de produção quebrado
**Localização:** `src/pages/Assistant/AssistantPage.tsx:5` e `:289`
**O que existe:** `npm run build` (`tsc -b && vite build`) falha hoje com 2 erros:
1. `TS6133` — `clearHistorico` é importado e nunca usado (sobra da revisão de arquitetura de sessões: "Nova conversa" passou a só gerar `sessao_id` novo, sem deletar do banco).
2. `TS2345` — `setSessaoId(items[0].sessao_id)`: o `useState(() => crypto.randomUUID())` inferiu o tipo template literal de UUID, e `sessao_id` é `string`.

**Impacto:** o deploy na Vercel falharia imediatamente; ninguém consegue gerar build de produção.
**Recomendação:** remover o import morto e tipar o estado explicitamente (`useState<string>(...)`). Adicionar `npm run build` a um check de CI/pre-push para impedir regressão.
*(Categoria formalmente técnica, mas classificado como o item nº 1 da auditoria por bloquear o deploy.)*

### FE-02 [SEGURANÇA] [Alto] [ANTES DO DEPLOY] — Sem headers de segurança para produção (CSP, Referrer-Policy, frame-ancestors)
**Localização:** raiz do projeto (não existe `vercel.json`); `index.html` (sem meta CSP/referrer)
**O que existe:** nenhuma configuração de headers HTTP. Na Vercel, o app servirá sem `Content-Security-Policy`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options` e `Permissions-Policy`. O `index.html:9-14` carrega Google Fonts de terceiro.
**Impacto:** defesa em profundidade ausente para um app financeiro: sem CSP, qualquer XSS futuro (ex.: dependência comprometida) tem caminho livre; sem `frame-ancestors`, clickjacking é possível; sem `Referrer-Policy` explícita, fica-se dependente do default do navegador (relevante para a página de reset — ver FE-04).
**Recomendação:** criar `vercel.json` com headers: CSP restritiva (`default-src 'self'`; `connect-src 'self' https://<api>`; `style-src` + `font-src` para Google Fonts — ou self-hostar a Inter e eliminar o terceiro), `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, `Permissions-Policy` mínima. Cruza com F-25 do backend.

### FE-03 [SEGURANÇA] [Médio] [ANTES DO DEPLOY] — Dependência vulnerável: react-router-dom (open redirect)
**Localização:** `package.json:20` (`react-router-dom ^6.30.3`)
**O que existe:** `npm audit` reporta 2 vulnerabilidades moderadas (GHSA-2j2x-hqr9-3h42): redirects same-origin iniciados com `//` são reinterpretados como URL protocol-relative → open redirect. Range afetado `>=6.7.0 <6.30.4`; **fix disponível em 6.30.4**.
**Impacto:** o app hoje só usa `Navigate`/`navigate` com caminhos fixos, então a exploração direta é improvável — mas é um app financeiro indo a produção com CVE conhecida e fix de patch-level.
**Recomendação:** `npm update react-router-dom` (6.30.4) antes do deploy.

### FE-04 [SEGURANÇA] [Médio] [ANTES DO DEPLOY] — Página de reset: token permanece na URL (cruza com F-25)
**Localização:** `src/pages/Auth/ResetPasswordPage.tsx:24-25,37`
**O que existe:** o token é lido de `useSearchParams` e a página redireciona para `/login` se ausente — correto. Porém o token **permanece na query string** durante todo o fluxo e fica gravado no histórico do navegador; não há `history.replaceState` após a leitura. A página (via `AuthLayout`/`index.html`) carrega Google Fonts de terceiro enquanto o token está na URL — com o default moderno (`strict-origin-when-cross-origin`) só a origem é enviada cross-origin, então o vazamento por referrer é improvável, mas não há `Referrer-Policy` explícita garantindo isso (FE-02).
**Impacto:** token de reset recuperável do histórico/sessões sincronizadas do navegador enquanto válido; dependência do default do browser para não vazar referrer.
**Recomendação:** capturar o token em estado e remover da URL (`window.history.replaceState`) no mount; combinar com `Referrer-Policy: no-referrer` (FE-02). Validar com o achado F-25 do backend (expiração/uso único do token mitigam o risco residual).

### FE-05 [SEGURANÇA] [Médio] [PÓS-DEPLOY] — Interceptor de refresh dispara para falhas de login/registro
**Localização:** `src/services/api.ts:26-67`
**O que existe:** o interceptor trata **qualquer** 401 como "token expirado". Um 401 de `POST /auth/login` (senha errada) ou de outros endpoints públicos de auth dispara `POST /auth/refresh`; quando o refresh falha, o erro **rejeitado de volta ao formulário é o do refresh**, não o do login (o `LoginPage:42-44` ainda mostra o fallback correto, mas o `detail` real do backend se perde). O caminho de falha em si é seguro: `clearAuth()` + rejeição, fila (`isRefreshing`/`failedQueue`) drenada corretamente, sem loop infinito (o retry da request original que falhar de novo com 401 entraria em novo ciclo de refresh — mitigado porque o refresh recém-sucedido torna isso improvável, mas não há flag `_retry` na request).
**Impacto:** chamada de rede extra a cada login errado; mensagens de erro do backend mascaradas; ausência de `_retry` permite, em cenário degenerado (backend devolvendo 401 com cookie válido), ciclos repetidos de refresh.
**Recomendação:** ignorar no interceptor URLs de auth público (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`) e marcar `originalRequest._retry = true` antes do retry.

### FE-06 [SEGURANÇA] [Baixo] [ANTES DO DEPLOY] — Fallback silencioso de API para localhost
**Localização:** `src/services/api.ts:6`
**O que existe:** `baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000'`. Se `VITE_API_URL` não for configurada no painel da Vercel, o bundle de produção aponta para `http://localhost:8000` sem nenhum aviso.
**Impacto:** app "quebrado em silêncio" em produção; requests HTTP em página HTTPS (mixed content bloqueado).
**Recomendação:** em build de produção (`import.meta.env.PROD`), lançar erro explícito se `VITE_API_URL` estiver ausente. Confirmado que não há nenhum segredo em variáveis `VITE_` (apenas a URL pública da API — correto).

### FE-07 [SEGURANÇA] [Baixo] [PÓS-DEPLOY] — PWA: verificação do escopo do service worker
**Localização:** `vite.config.ts:8-25`; `dist/sw.js` (gerado)
**O que existe:** `generateSW` com defaults: o SW gerado **apenas pré-cacheia os assets estáticos do build** e registra um `NavigationRoute` para `index.html`. Não há runtime caching — **nenhuma resposta autenticada da API é cacheada** (verificado no `sw.js` gerado). `registerType: 'autoUpdate'` mantém o app atualizado.
**Impacto:** comportamento atual é seguro. O risco é futuro: se alguém adicionar `runtimeCaching` para a API sem excluir endpoints autenticados, dados financeiros irão parar no Cache Storage.
**Recomendação:** documentar essa restrição; se um dia houver cache offline de API, usar `NetworkOnly` para `/auth/*` e `/ai/*` e revisar caso a caso.

**Verificações sem achado (Seção 1):**
- **XSS:** zero ocorrências de `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write`, `href` dinâmico com dado de usuário. As duas únicas `a.href` são `URL.createObjectURL` de blobs gerados localmente (`SettingsPage.tsx:60-63`, `ImportPage.tsx:116-119`). `react-markdown` (Assistente) não renderiza HTML bruto por padrão.
- **Token:** `authStore.ts` guarda apenas `{user, isAuthenticated}` em memória; `localStorage` só é usado para a flag de onboarding (`OnboardingBanner.tsx:36,42`). Conformidade total com a regra "JWT nunca em localStorage".
- **Guarda de rota:** `ProtectedRoute` (`App.tsx:30-33`) só renderiza `Outlet` se `isAuthenticated`, e `AuthInitializer` bloqueia a árvore até o `getMe()` resolver — não há janela em que rotas autenticadas renderizem sem auth. (Defesa real continua sendo o servidor, como esperado.)
- **Enumeração de e-mail:** `ForgotPasswordPage.tsx:28-36` exibe mensagem genérica independente do resultado — correto.

---

## Seção 2 — Técnica / qualidade de código

### FE-08 [TÉCNICA] [Alto] [ANTES DO DEPLOY] — Sugestão de categoria por IA polui o histórico persistente do chat
**Localização:** `src/services/ai.ts:33-51` (`suggestCategory`); `src/pages/AddTransaction/AddTransactionPage.tsx:281-291`
**O que existe:** a sugestão de categoria reutiliza `sendMessage()` → `POST /ai/chat`. Desde a implementação de "Persistência e Memória", esse endpoint **salva a mensagem do usuário e a resposta no banco** (`chat_messages`) e injeta as últimas 50 mensagens como contexto da IA. Cada disparo do debounce (descrição ≥ 3 chars, 500ms) portanto:
1. grava o prompt interno ("Dada a transação X, responda APENAS...") e a resposta como mensagens do usuário no banco;
2. consome as 50 posições de memória invisível da IA com lixo de sugestão;
3. cria um `sessao_id` novo a cada chamada (`crypto.randomUUID()` em `ai.ts:44`) — tornando a sugestão a **sessão mais recente** do usuário. Se `GET /ai/historico` retorna a sessão mais recente com menos de 24h (regra documentada em SESSAO_ATUAL.md), o usuário que abrir o Assistente verá o prompt interno de sugestão como sua "conversa". *(Comportamento final depende da implementação do backend — confirmar em runtime; a poluição da memória de 50 mensagens e a gravação no banco independem disso.)*

Há ainda um aspecto de privacidade: descrições de transação são enviadas ao Gemini automaticamente enquanto o usuário digita, sem ação explícita.
**Impacto:** memória do Assistente degradada, histórico de chat potencialmente corrompido na UI, custo de chamadas Gemini a cada digitação, dado financeiro enviado a terceiro por digitação parcial.
**Recomendação:** criar endpoint dedicado de sugestão no backend (sem persistência em `chat_messages`) e um service próprio no frontend; alternativamente, disparar a sugestão apenas no blur do campo. Cruza com a pendência "validar histórico completo ao reabrir" — este achado é uma causa plausível de comportamento estranho nesse teste.

### FE-09 [TÉCNICA] [Alto] [ANTES DO DEPLOY] — TypeScript sem `strict`
**Localização:** `tsconfig.app.json` (não há `"strict": true` em nenhum tsconfig)
**O que existe:** o projeto compila sem `strict` — logo sem `strictNullChecks`, `noImplicitAny` etc. Exemplos de riscos que passam silenciosamente: `MobileLayout.tsx:15` / `DesktopLayout.tsx:15` (`user?.username?.[0].toUpperCase()` lança TypeError se `username === ''`); todos os `parseFloat(...)` de campos do backend sem null-check.
**Impacto:** justamente a classe de bug que o projeto já sofreu nos testes (`percentual.toFixed is not a function`, `R$ NaN`) fica sem detecção estática; a futura mudança de contrato do backend (envelope paginado) falhará em runtime em vez de no compile.
**Recomendação:** habilitar `"strict": true` e corrigir os erros resultantes (esforço único, projeto pequeno). Fazer antes do deploy enquanto a base é gerenciável.

### FE-10 [TÉCNICA] [Médio] [ANTES DO DEPLOY] — Acoplamento ao contrato atual: lista nua e sem validação de resposta (cruza com /api/v1 e paginação do backend)
**Localização:** `src/services/transactions.ts:28-32` (`getTransactions`, `getAllTransactions`), `cards.ts:58-59`, `categories.ts:12-13`, `installments.ts:18-24`, `ai.ts:24-27`
**O que existe:** todos os services tipam a resposta como array nu (`api.get<Transaction[]>`) e nenhum valida o shape em runtime. `getAllTransactions()` chama `GET /transactions` sem parâmetros (usado no backup JSON em `SettingsPage.tsx:184`). Quando o backend migrar para `/api/v1` + envelope paginado (`{items, total, page...}`), **todas as listagens quebram em runtime sem erro de compilação** (agravado por FE-09): `.filter`/`.map` em objeto não-array.
**Impacto:** migração do backend exigirá caça manual de quebras; backup exportaria envelope em vez de lista.
**Recomendação:** (1) o prefixo `/api/v1` é trivial — basta incluí-lo em `VITE_API_URL`, já que todos os paths dos services são relativos (ponto positivo); (2) criar um unwrap central por service (ex.: `unwrapList<T>(data): T[]` que aceita array nu OU envelope) **antes** da migração, permitindo transição sem big-bang; (3) idealmente validar respostas com schemas Zod (a lib já está no projeto) nos services de dados financeiros.

### FE-11 [TÉCNICA] [Médio] [ANTES DO DEPLOY] — Sem code splitting: bundle único de 1.014 kB
**Localização:** `src/App.tsx:7-23` (todas as páginas importadas estaticamente); evidência: `vite build` → `dist/assets/index-*.js  1.014,56 kB │ gzip: 297,66 kB` (com warning de chunk > 500 kB)
**O que existe:** nenhuma rota usa `React.lazy`; Recharts (~400 kB no bundle) e react-markdown são carregados no boot mesmo para quem só abre o login. O PWA pré-cacheia o chunk inteiro (1.013 KiB de precache).
**Impacto:** primeiro carregamento (e cada atualização de versão do SW) baixa ~300 kB gzip; a meta documentada de "Dashboard < 2s" fica mais difícil em 4G. *(Tempo real só confirmável em runtime.)*
**Recomendação:** `React.lazy` + `Suspense` por rota (Summary, Assistant, Import e Cards são os maiores ganhos: isolam recharts e react-markdown); opcionalmente `build.rollupOptions.output.manualChunks` para vendor split.

### FE-12 [TÉCNICA] [Médio] [PÓS-DEPLOY] — Invalidação de cache TanStack incompleta após mutações
**Localização:** `src/hooks/useTransactions.ts:19-59`
**O que existe:** criar/editar/excluir transação invalida apenas `['transactions', ...]` e `['statistics','monthly', ...]`. Não invalida: `['installments']` (widget "Compromissos futuros" do Dashboard e card "Parcelas — Próx. Mês" do Summary), `['invoices']`/`['invoice-detail']` (fatura do cartão após compra no crédito), `['cards']` (`fatura_aberta_total` da barra de limite), `['statistics','yearly'|'categories']` (gráficos do Summary).
**Impacto:** após adicionar uma compra parcelada no cartão, a fatura, a barra de limite e o widget de parcelas mostram dados defasados por até 2–5 min (staleTime) ou até refetch por foco.
**Recomendação:** invalidar por prefixo amplo nas mutações de transação: `['installments']`, `['invoices']`, `['invoice-detail']`, `['cards']`, `['statistics']`.

### FE-13 [TÉCNICA] [Médio] [PÓS-DEPLOY] — Importação CSV cria dados inconsistentes com o restante do app
**Localização:** `src/pages/Import/ImportPage.tsx:14` (`VALID_FORMAS = ['dinheiro','debito','credito','pix']`) vs `TransactionsPage.tsx:21` / `AddTransactionPage.tsx:19` (`['Débito','Crédito','PIX','Dinheiro','TED/DOC']`)
**O que existe:** o CSV aceita formas de pagamento em minúsculas/sem acento, e o payload envia esses valores crus (`ImportPage.tsx:139`). O filtro de transações compara por igualdade exata (`TransactionsPage.tsx:127`).
**Impacto:** transações importadas nunca casam com os filtros de forma de pagamento ("PIX" ≠ "pix"); a UI exibirá grafias mistas. Além disso, o parser (`parseCSV`, linha 38-39) usa `split(',')` sem suporte a aspas — campos com vírgula quebram silenciosamente em colunas erradas (há aviso na UI, mas valores como `"1.234,56"` também são afetados).
**Recomendação:** normalizar `forma_pagamento` para o vocabulário canônico no import (mapa `pix → PIX` etc.) — ou validar contra a mesma constante compartilhada; considerar parser CSV com suporte a aspas (ex.: papaparse) ou documentar o template como única forma suportada.

### FE-14 [TÉCNICA] [Baixo] [PÓS-DEPLOY] — Código morto
**Localização e itens:**
- `src/App.css` (estilos do template Vite, ~160 linhas com `@media` — não importado em lugar nenhum; é o único lugar com media query CSS, e está morto)
- `src/assets/react.svg`, `src/assets/vite.svg` (não referenciados)
- `src/hooks/useAuth.ts` (nunca importado)
- `src/store/uiStore.ts:15,18-19,26,33-34` (`setLoading`, `openModal`, `closeModal`, `activeModal` — nunca usados; só toasts são consumidos)
- `src/services/cards.ts:70-71` (`deleteCard` nunca chamado — o app usa `deactivateCard`)
- `src/services/auth.ts:30-31` (`refreshToken` exportado e nunca importado — o interceptor chama `api.post('/auth/refresh')` inline)
- `src/components/cards/InvoiceDetail.tsx:13` (prop `invoiceMeta` declarada e nunca usada)
- `src/pages/Transactions/SummaryPage.tsx:300-312` (`_prevQ` calculado e nunca consumido — comparação de trimestre não implementada)

**Impacto:** ruído de manutenção; o `App.css` em particular pode confundir futuras leituras sobre a regra "sem media query".
**Recomendação:** remover em um commit de limpeza.

### FE-15 [TÉCNICA] [Baixo] [PÓS-DEPLOY] — Duplicação de helpers e constantes
**Localização:** `formatBRL` definido **13 vezes** (DonutChart, BarChart ×2, CardVisual, InvoiceDetail, InvoiceMonthGrid, TransactionGroup, TransactionItem, TransactionsPage, AddTransactionPage, DashboardPage, SummaryPage, AssistantPage); `MONTHS`/`MONTHS_SHORT` em 6 arquivos; `FORMAS_PAGAMENTO` em 3 (com a divergência do FE-13); `extractDetail` duplicado (`SettingsPage.tsx:42-55` e `RegisterPage.tsx:23-36`); `MetricCard` quase idêntico em `DashboardPage.tsx:77-99` e `SummaryPage.tsx:72-105`; `formatVariacao` duplicado nas mesmas páginas; skeletons longos repetidos por página.
**Impacto:** mudanças de formatação/vocabulário exigem N edições; foi exatamente assim que FE-13 nasceu.
**Recomendação:** criar `src/lib/format.ts` (formatBRL, formatVariacao, datas) e `src/lib/constants.ts` (MONTHS, FORMAS_PAGAMENTO); extrair `MetricCard` para `components/ui/`.

### FE-16 [TÉCNICA] [Baixo] [PÓS-DEPLOY] — Casts de tipo conhecidos e contidos
**Localização:** `AddTransactionPage.tsx:250,337` (`'' as unknown as number` no defaultValue de `valor`); `AddTransactionPage.tsx:246`, `EditTransactionModal.tsx:48`, `CardFormModal.tsx:45` (`zodResolver(schema) as Resolver<...>`); `DonutChart.tsx:58-60`, `BarChart.tsx:81-87` (formatters `(value: unknown)` com cast interno)
**O que existe:** os únicos casts do projeto são os três padrões já documentados em SESSAO_ATUAL.md como decisões (limitações Zod v4 + RHF e tipos do Recharts). Não há `any` no código. O `'' as unknown as number` é o mais frágil: o tipo do form mente sobre o estado inicial do campo (mitigado pelo `z.coerce` + `String(data.valor)` no payload).
**Impacto:** baixo — contido e comentado; vale registro para a futura ativação do `strict` (FE-09).
**Recomendação:** manter; ao habilitar strict, considerar `valor: z.string()` no input type + transform no schema, eliminando o cast.

### FE-17 [TÉCNICA] [Baixo] [PÓS-DEPLOY] — Paleta definida em três lugares
**Localização:** `tailwind.config.ts:7-24`, `src/styles/tokens.css:3-12` (variáveis CSS que nada consome — o Tailwind usa hex direto), `src/index.css:15-16` (body com hex hardcoded)
**O que existe:** três fontes de verdade para as mesmas 10 cores. Os hex em `DonutChart`/`BarChart` são limitação real do Recharts (SVG sem classe) e estão comentados como tal — conformidade aceitável; o restante do app usa exclusivamente tokens Tailwind (verificado por grep: zero hex fora de charts/css base).
**Impacto:** mudança de paleta exige edição em 3+ lugares.
**Recomendação:** fazer o `tailwind.config.ts` consumir as variáveis de `tokens.css` (`colors: { amber: 'var(--color-amber)' }`) e o `index.css` usar `@apply bg-bg text-text-primary` — uma fonte de verdade.

### FE-18 [TÉCNICA] [Baixo] [PÓS-DEPLOY] — Histórico do chat (dado de servidor) gerenciado em useState local
**Localização:** `src/pages/Assistant/AssistantPage.tsx:273,282-302`
**O que existe:** `getHistorico()` é chamado em `useEffect` manual e armazenado em `useState`, fora do TanStack Query — tecnicamente uma exceção à regra "dados de servidor no TanStack". Para chat append-only com optimistic updates, o estado local é defensável, mas perde-se cache entre navegações (cada visita ao Assistente refaz o GET e re-renderiza do zero) e o padrão `cancelled` manual reimplementa o que o Query dá de graça.
**Impacto:** baixo; inconsistência arquitetural documentável.
**Recomendação:** ou documentar como exceção deliberada em SESSAO_ATUAL.md, ou migrar para `useQuery(['ai','historico'])` + `setQueryData` no envio.

### FE-19 [TÉCNICA] [Baixo] [PÓS-DEPLOY] — Race condition na sugestão de categoria
**Localização:** `src/pages/AddTransaction/AddTransactionPage.tsx:282-291`
**O que existe:** o `useEffect` do debounce chama `suggestCategory(...).then(setSuggestedCategory)` sem cancelamento/guarda de stale: se o usuário continuar digitando, uma resposta antiga pode chegar depois da nova e sobrescrever a sugestão correta.
**Impacto:** sugestão ocasionalmente errada para o texto atual (cosmético; some quando FE-08 for resolvido com endpoint dedicado).
**Recomendação:** guarda `let active = true` no effect (padrão já usado no `AssistantPage:283`).

**Verificações de conformidade sem achado (Seção 2):**
- **Responsividade:** zero media queries vivas e zero prefixos `sm:`/`md:`/`lg:` no `src/` — toda bifurcação é `useBreakpoint('md')` → `MobileLayout`/`DesktopLayout`. Conformidade total.
- **TanStack vs Zustand:** fora da exceção FE-18, a separação é limpa — Zustand só tem auth (memória) e toasts; todo fetch passa por hooks de Query.
- **Um service por domínio:** `api, auth, transactions, categories, cards, ai, statistics, installments` — espelha os routers do backend.
- **toFixed(2):** todos os payloads monetários enviam `parseFloat(String(v).replace(',', '.')).toFixed(2)` (AddTransaction:311, EditTransactionModal:61, ImportPage:135). Exibição usa `Intl.NumberFormat pt-BR` — superior ao `toFixed` para UI e coerente com a intenção da regra (precisão no envio).

---

## Seção 3 — UX / Acessibilidade (detectável no código)

### FE-20 [UX] [Médio] [ANTES DO DEPLOY] — Botões de exportação sem implementação
**Localização:** `src/pages/Cards/CardsPage.tsx:202-204` (`handleExport` = `console.log('TODO: exportar fatura', ...)`); `src/pages/Transactions/SummaryPage.tsx:417-424` (botão "↑ Exportar" com `onClick={() => {/* placeholder */}}`)
**O que existe:** dois botões visíveis e clicáveis que não fazem nada. O "Exportar fatura" da fatura ganhou `disabled={isEmpty}` recentemente, mas quando habilitado só loga no console. "Exportar fatura em PDF" e "Exportar relatório" constam como features no documento de referência.
**Impacto:** usuário em produção clica e nada acontece — percepção de bug.
**Recomendação:** antes do deploy, ou implementar, ou ocultar os botões (esconder é 2 linhas). Registrar a feature como pós-launch.

### FE-21 [UX] [Médio] [PÓS-DEPLOY] — Modais sem semântica de diálogo nem gestão de foco
**Localização:** `src/components/ui/Modal.tsx` (todos os usos); `src/pages/Assistant/AssistantPage.tsx:388-411` (modal custom)
**O que existe:** o `Modal` trata ESC e clique no overlay, mas: sem `role="dialog"`/`aria-modal="true"`, sem focus trap, sem foco inicial, sem devolução de foco ao fechar, e o conteúdo de fundo continua tabulável. O modal de confirmação do Assistente nem usa o componente `Modal` — é um div próprio **sem ESC e sem fechamento por overlay**, inconsistente com o resto do app.
**Impacto:** navegação por teclado/leitor de tela fica perdida ao abrir qualquer modal (formulários de cartão, edição/exclusão de transação, logout).
**Recomendação:** usar `<dialog>` nativo ou adicionar role/aria-modal + focus trap simples no `Modal`; substituir o modal custom do Assistente pelo componente compartilhado.

### FE-22 [UX] [Médio] [PÓS-DEPLOY] — Cobertura de estados: erro ausente em metade das views
**Localização:** com `isError`: Dashboard (`DashboardPage.tsx:285-292`) e Transações (`TransactionsPage.tsx:352-359`). **Sem tratamento de erro:** `SummaryPage` (nenhum `isError` — se as estatísticas falham, a página renderiza seções vazias degeneradas), `CardsPage`/`InvoicePanel` (falha vira "vazio" perpétuo), `AssistantPage` StatsPanel e histórico (`catch` silencioso em `:299` — falha de rede mostra chat vazio como se fosse primeiro acesso), `useCategories`/`useInstallments` consumidores.
**O que existe:** loading (skeletons) e empty states são exemplares em todas as views; o terceiro estado falta.
**Impacto:** falha de API é indistinguível de "sem dados" — usuário pode achar que perdeu transações/conversas.
**Recomendação:** padrão mínimo: componente `ErrorState` reutilizável (já existe o padrão visual no Dashboard) aplicado a Summary, Cards e Assistant; no histórico do chat, distinguir vazio de erro (toast "não foi possível carregar o histórico").

### FE-23 [UX] [Médio] [PÓS-DEPLOY] — Alvos de toque abaixo de 44px em ações principais do mobile
**Localização:** `TransactionItem.tsx:37-50` (editar/excluir: `w-7 h-7` = 28px); `Modal.tsx:29-35` (fechar: 28px); `MobileLayout.tsx:24-33` (avatar/Configurações: `w-8 h-8` = 32px); chips de filtro `py-1.5` (~30px de altura)
**O que existe:** as ações de editar/excluir transação — fluxo central do app — têm 28×28px, abaixo dos 44px (Apple HIG) / 48px (Material) recomendados.
**Impacto:** toques errados frequentes em mobile, inclusive tocar "excluir" mirando "editar" (mitigado pelo modal de confirmação).
**Recomendação:** aumentar a área clicável com padding mantendo o ícone (ex.: `w-10 h-10 -m-1.5`); FAB (56px) e botões de formulário (`py-3`) já estão adequados.

### FE-24 [UX] [Baixo] [PÓS-DEPLOY] — Contraste: text-muted sobre surface fica abaixo de AA
**Localização:** tokens `#888580` (text-muted) sobre `#2A2520` (bg-surface) — usado em praticamente todos os cards para labels/captions de 12px
**O que existe:** calculado a partir dos tokens: `#888580` sobre `#1A1714` (bg) ≈ **4,9:1** (passa AA); sobre `#2A2520` (surface) ≈ **4,1:1** — **abaixo de 4,5:1** exigido para texto normal (passa apenas como texto grande). Também: `text-bg/60` (60% de opacidade) sobre o gradiente âmbar do `CardVisual.tsx:49,59` tende a ficar baixo — só confirmável em runtime.
**Impacto:** legibilidade reduzida para baixa visão exatamente nos labels de valores financeiros dentro de cards.
**Recomendação:** clarear o token muted (~`#9A968F` dá ≥4,5:1 sobre surface) ou usar text-primary para captions sobre surface; auditar o CardVisual com DevTools após deploy.

### FE-25 [UX] [Baixo] [PÓS-DEPLOY] — Toasts invisíveis para leitores de tela e com dismiss fixo
**Localização:** `src/components/ui/Toast.tsx`
**O que existe:** container sem `role="status"`/`aria-live="polite"`; auto-dismiss fixo de 3s sem pausa em hover/focus.
**Impacto:** feedback de sucesso/erro (único canal de confirmação de várias mutações) não é anunciado por leitores de tela; 3s pode ser curto para mensagens de erro mais longas.
**Recomendação:** `role="status"` no container (erros: `role="alert"`); pausar timer no hover; erros poderiam persistir até dismiss manual.

### FE-26 [UX] [Baixo] [PÓS-DEPLOY] — Tela branca durante a inicialização de auth
**Localização:** `src/App.tsx:47` (`if (!initialized) return null`)
**O que existe:** até o `GET /auth/me` resolver, o app renderiza nada (fundo branco do html, já que `bg` é aplicado no body via CSS — na prática fundo escuro vazio).
**Impacto:** em rede lenta, segundos de tela vazia a cada cold start do PWA — percepção de travamento.
**Recomendação:** renderizar um splash mínimo (logo + spinner) no lugar de `null`.

### FE-27 [UX] [Baixo] [PÓS-DEPLOY] — Associação label↔input incompleta em alguns campos
**Localização:** `TransactionsPage.tsx:378-383,552-557` (inputs de busca sem `aria-label`, só placeholder); `SettingsPage.tsx:240-256` (campo Nome usa `<p>` como rótulo, sem `htmlFor`/`id`); `AssistantPage.tsx:243-252` (textarea do chat sem `aria-label`); labels de formulário em `AddTransactionPage` (Tipo, Categoria, Forma de pagamento) são `<label>` sem `htmlFor` apontando para grupos de botões (aqui um `role="radiogroup"` + `aria-label` seria o correto)
**O que existe:** o componente `Input` faz associação correta quando recebe `id` (auth, settings senha), mas os casos acima ficam sem nome acessível.
**Impacto:** leitores de tela anunciam "edit text" sem contexto nos campos de busca e chat.
**Recomendação:** `aria-label` nos campos de busca/chat; `htmlFor`+`id` no campo Nome; `role="radiogroup"`/`role="group"` + `aria-label` nos seletores de botão.

### FE-28 [UX] [Baixo] [PÓS-DEPLOY] — Três padrões diferentes para botão destrutivo
**Localização:** `Button.tsx:15` define `variant="danger"` (outline) — usado em Settings/logout/reset; `DeleteConfirmModal.tsx:23-29` usa `<button>` cru com `bg-danger` sólido; `CardsPage.tsx:47` usa `Button` primário com override `!bg-danger hover:!bg-danger/80`.
**O que existe:** três estilos distintos para a mesma semântica (confirmar ação destrutiva), um deles com `!important` brigando com o design system.
**Impacto:** inconsistência visual e de manutenção; `!` override é frágil.
**Recomendação:** adicionar `variant="danger-solid"` ao `Button` e usar nos dois modais.

### FE-29 [UX] [Baixo] [PÓS-DEPLOY] — Modais de formulário fecham por overlay/ESC sem confirmação
**Localização:** `Modal.tsx:11-24` + usos em `CardFormModal`, `EditTransactionModal`, modal de nova categoria
**O que existe:** clique acidental no overlay ou ESC descarta o formulário preenchido sem aviso.
**Impacto:** perda de dados digitados (irritante no CardFormModal, que tem 6 campos).
**Recomendação:** nos modais com formulário "sujo" (`isDirty` do RHF), pedir confirmação ou desabilitar fechamento por overlay.

**Verificações sem achado (Seção 3):**
- **Ações destrutivas com confirmação:** todas — excluir transação, desativar cartão, remover categoria (inline), logout, resetar assistente, nova conversa. Textos claros e específicos.
- **Validação de formulários:** RHF + Zod com `mode: 'onChange'`, mensagens por campo, botão desabilitado quando inválido, toasts de erro de rede em todas as mutações — consistente em todo o app.
- **Imagens:** não há `<img>` com conteúdo; ícones são SVG inline decorativos (Spinner corretamente com `aria-hidden`) ou caracteres unicode. Os ícones unicode da navegação (⊞ ↕ ▭ ✦) têm texto adjacente visível, então têm nome acessível.
- **aria-labels em botões icon-only:** presentes em todos que verifiquei (voltar, fechar, enviar, mês anterior/próximo, adicionar cartão, editar/deletar transação com descrição interpolada — `TransactionItem.tsx:40,47`).

---

## Pontos fortes

1. **Disciplina arquitetural real** — as seis regras não-negociáveis foram verificadas contra o código e cinco estão em conformidade total (a sexta, TanStack/Zustand, tem uma única exceção defensável no chat). Zero media queries vivas, zero cores hardcoded fora da limitação documentada do Recharts, services espelhando os routers do backend.
2. **Manejo de token exemplar para SPA** — JWT exclusivamente em cookie httpOnly; o estado em memória guarda só o perfil; interceptor de refresh com serialização de 401s paralelos (`isRefreshing`/`failedQueue`) e caminho de falha que limpa o auth.
3. **Superfície de XSS minimizada** — nenhum sink no código; markdown da IA renderizado por `react-markdown` com componentes whitelistados; respostas de erro do backend exibidas via JSX (escapadas).
4. **Estados de loading e empty de alta qualidade** — skeletons específicos por layout em todas as páginas principais; empty states contextuais (inclusive diferenciando "sem dados no mês" de "nenhum resultado de filtro", e mobile de desktop).
5. **PWA conservador e seguro** — service worker só pré-cacheia assets estáticos; nenhuma resposta autenticada vai ao Cache Storage; `autoUpdate` evita versões zumbis.
6. **Boas práticas de auth nos formulários** — `autocomplete` correto (`current-password`/`new-password`), mensagem anti-enumeração no forgot-password, dupla confirmação de senha, toggle de visibilidade fora do tab order.
7. **Precisão monetária** — normalização vírgula→ponto + `toFixed(2)` em todos os payloads; `Intl.NumberFormat pt-BR` na exibição; parsers centralizados em `statistics.ts` convertendo os Decimals-string do backend.
8. **TypeScript sem `any`** — os únicos casts são três padrões documentados e justificados em SESSAO_ATUAL.md.

---

## Tabela-resumo

| ID | Categoria | Sev. | Quando | Localização | Resumo |
|---|---|---|---|---|---|
| FE-01 | SEGURANÇA/TÉCNICA | Crítico | ANTES | AssistantPage.tsx:5,289 | Build de produção quebrado (2 erros tsc) — deploy falharia |
| FE-02 | SEGURANÇA | Alto | ANTES | (sem vercel.json) | Sem CSP/Referrer-Policy/frame-ancestors em produção |
| FE-03 | SEGURANÇA | Médio | ANTES | package.json:20 | react-router-dom < 6.30.4 — open redirect (fix disponível) |
| FE-04 | SEGURANÇA | Médio | ANTES | ResetPasswordPage.tsx:24-37 | Token de reset fica na URL/histórico; sem replaceState (cruza F-25) |
| FE-05 | SEGURANÇA | Médio | PÓS | api.ts:26-67 | Interceptor refresca em 401 de login; erro mascarado; sem flag _retry |
| FE-06 | SEGURANÇA | Baixo | ANTES | api.ts:6 | Fallback silencioso p/ localhost se VITE_API_URL ausente |
| FE-07 | SEGURANÇA | Baixo | PÓS | vite.config.ts:8-25 | SW seguro hoje; documentar restrição contra runtime caching da API |
| FE-08 | TÉCNICA | Alto | ANTES | ai.ts:33-51; AddTransactionPage.tsx:281-291 | Sugestão IA grava no histórico do chat e polui memória/sessões |
| FE-09 | TÉCNICA | Alto | ANTES | tsconfig.app.json | TypeScript sem strict mode |
| FE-10 | TÉCNICA | Médio | ANTES | services/*.ts | Lista nua sem validação — quebra silenciosa com envelope paginado (/api/v1) |
| FE-11 | TÉCNICA | Médio | ANTES | App.tsx:7-23 | Sem code splitting — bundle único de 1.014 kB (297 kB gzip) |
| FE-12 | TÉCNICA | Médio | PÓS | useTransactions.ts:19-59 | Invalidação incompleta (installments/invoices/cards/statistics) |
| FE-13 | TÉCNICA | Médio | PÓS | ImportPage.tsx:14,139 | CSV importa forma_pagamento fora do vocabulário — filtros não casam |
| FE-14 | TÉCNICA | Baixo | PÓS | vários | Código morto (App.css, useAuth, uiStore parcial, deleteCard etc.) |
| FE-15 | TÉCNICA | Baixo | PÓS | vários | formatBRL ×13, MONTHS ×6, MetricCard/extractDetail duplicados |
| FE-16 | TÉCNICA | Baixo | PÓS | AddTransactionPage:250 etc. | Casts conhecidos (zodResolver/Recharts/valor) — contidos |
| FE-17 | TÉCNICA | Baixo | PÓS | tailwind.config/tokens.css/index.css | Paleta definida em 3 lugares |
| FE-18 | TÉCNICA | Baixo | PÓS | AssistantPage.tsx:273-302 | Histórico do chat em useState (exceção à regra TanStack) |
| FE-19 | TÉCNICA | Baixo | PÓS | AddTransactionPage.tsx:282-291 | Race condition na sugestão de categoria |
| FE-20 | UX | Médio | ANTES | CardsPage.tsx:202; SummaryPage.tsx:417 | Botões "Exportar" sem implementação (console.log/placeholder) |
| FE-21 | UX | Médio | PÓS | Modal.tsx; AssistantPage.tsx:388 | Modais sem role/aria-modal/focus trap; modal custom inconsistente |
| FE-22 | UX | Médio | PÓS | SummaryPage/CardsPage/AssistantPage | Estado de erro ausente (falha de API parece "sem dados") |
| FE-23 | UX | Médio | PÓS | TransactionItem.tsx:37-50 etc. | Alvos de toque de 28px em ações principais |
| FE-24 | UX | Baixo | PÓS | tokens (#888580/#2A2520) | Contraste 4,1:1 < AA p/ texto pequeno sobre surface |
| FE-25 | UX | Baixo | PÓS | Toast.tsx | Toasts sem aria-live; dismiss fixo 3s |
| FE-26 | UX | Baixo | PÓS | App.tsx:47 | Tela vazia durante init de auth |
| FE-27 | UX | Baixo | PÓS | buscas/chat/Settings nome | Campos sem nome acessível (label/aria-label) |
| FE-28 | UX | Baixo | PÓS | DeleteConfirmModal/CardsPage/Button | 3 padrões de botão destrutivo |
| FE-29 | UX | Baixo | PÓS | Modal.tsx:11-24 | Overlay/ESC descartam formulário preenchido sem aviso |

**Checklist mínimo antes do deploy:** FE-01 (build), FE-08 (sugestão IA × histórico), FE-02 (vercel.json com headers), FE-03 (`npm update react-router-dom`), FE-04 (replaceState no reset), FE-06 (falhar sem VITE_API_URL), FE-20 (ocultar botões de export), FE-09/FE-10/FE-11 fortemente recomendados enquanto a base é pequena.

---

*Auditoria somente-leitura — nenhum arquivo de código foi modificado. Achados de comportamento em runtime (FE-08 item 3, FE-24 CardVisual, tempo de carregamento em FE-11) estão marcados como dependentes de confirmação em execução.*
