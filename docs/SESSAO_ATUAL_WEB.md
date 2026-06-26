# Hivvo — Sessão Atual (hivvo-web)

## Antes de começar
Leia `docs/Hivvo_Referencia.md` (canônica, espelhada com o hivvo-api), `docs/SESSAO_ATUAL.md`, `docs/AUDITORIA_FRONTEND.md` e `docs/PLANO_EXECUCAO_WEB.md`. Não proponha alternativas de tecnologia — já decididas. Uma tarefa/batch por vez, com aprovação antes do commit.

> Este `SESSAO_ATUAL.md` é **específico do hivvo-web**. O hivvo-api tem o seu próprio. A `Hivvo_Referencia.md` é a única doc compartilhada (idêntica nos dois repos).

---

## Estado do Projeto

**Fase atual:** Hardening pré-deploy (frontend)
**Status:** Frontend feature-complete e funcional. Em 11/06/2026 passou por duas auditorias — código (`AUDITORIA_FRONTEND.md`, 29 achados) e renderizado (log do Claude Chrome). O trabalho ativo é executar o `PLANO_EXECUCAO_WEB.md` antes do deploy.
**✅ Web-Batch 1 concluído (11/06/2026):** build verde (FE-01), hook pre-push com `npm run build` (husky), erro explícito sem `VITE_API_URL` em produção (FE-06), react-router-dom 6.30.4 (FE-03, `npm audit` zerado), botões "Exportar" ocultados (FE-20).
**✅ Web-Batch 2 concluído (11/06/2026):** Inter self-hosted via @fontsource (FE-02a), `vercel.json` com headers de segurança (FE-02b), registro do SW confirmado como arquivo externo (FE-02c, sem mudança), token de reset fora da URL (FE-04).
**✅ Web-Batch 4 concluído (25/06/2026):** sugestão de categoria via endpoint dedicado `POST /ai/suggest-category` (resolve FE-08 no cliente) — removido o caminho antigo que reusava `/ai/chat`/`sendMessage` (origem da poluição do histórico do Assistente); disparo no **blur** da descrição (sem debounce de digitação); envio do `tipo` corrente; guarda de resposta obsoleta via token de sequência (FE-19); sugestão não sobrescreve escolha manual.
**✅ Web-Batch 3 concluído (26/06/2026):** cluster de categorias resolvido no frontend (`GET /categories` confirmado correto, sem dedupe por id) — key composta estável (`padrao:${tipo}:${nome}` p/ padrão, `id` p/ custom), ✕ exibido só quando `is_padrao === false`, grid de Adicionar filtrado pelo tipo corrente; type `Category` alinhado ao contrato real (removido `usuario_id` fantasma e `cor`; adicionados `tipo`/`is_padrao`/`criado_em`; `id` agora `number | null`).
**✅ FE-12 concluído (26/06/2026):** invalidação de cache de cartões/faturas após mutação de transação. As 3 mutations (`useCreateTransaction`/`useUpdateTransaction`/`useDeleteTransaction`) passam a invalidar também `['cards']`, `['invoices']`, `['invoice-detail']` e `['installments']` (por prefixo), além das invalidações já existentes de `transactions`/`statistics`. Só invalidação de cache — sem mexer no widget, paginação ou unwrap (demais itens do Web-Batch 8 seguem pendentes).
**Próximo passo imediato:** próximos itens pré-deploy do `PLANO_EXECUCAO_WEB.md` (FE-09 strict TS / FE-10 / FE-11 conforme priorização).

---

## Auditorias e Plano de Correção (11/06/2026)

| Documento | Conteúdo |
|---|---|
| `docs/AUDITORIA_FRONTEND.md` | 29 achados (FE-01 a FE-29): 1 Crítico, 3 Altos, 11 Médios, 14 Baixos. Forte: disciplina arquitetural, JWT só em cookie httpOnly, zero XSS, SW não cacheia API. |
| Log do Claude Chrome (renderizado) | Confirmou FE-08 e FE-01; achou bugs novos: cluster de categorias e barra de limite no mês errado. |
| `docs/PLANO_EXECUCAO_WEB.md` | Batches ordenados (pré e pós-deploy), fundindo FE-xx + achados do Chrome + pontos cross-repo. |

### Revelação importante
**FE-08 é a causa-raiz do mistério do histórico do Assistente** (o item de validação que vinha "aguardando o Gemini estabilizar"). A sugestão de categoria por IA reutiliza `POST /ai/chat`, que persiste no `chat_messages` — então cada digitação na descrição de transação gravava o prompt interno de sugestão como "mensagem do usuário", poluía a memória de 50 mensagens e podia virar a "sessão mais recente" exibida no chat. O Chrome confirmou: o prompt de sugestão **vaza visivelmente no histórico do Assistente**. Não era instabilidade do Gemini. Fix = endpoint dedicado de sugestão sem persistência (cross-repo).

### Bugs novos achados pelo Chrome (não estavam na auditoria de código)
- **Cluster de categorias** — ✅ **resolvido no Web-Batch 3 (26/06/2026).** A investigação read-only no hivvo-api concluiu que `GET /categories` está **correto**: as 15 padrão são objetos sintéticos com `id=null`/`is_padrao=true` e as duas "Outros" (uma despesa, uma receita) são **legítimas** (não é duplicata-bug). O *key collision* vinha de usar `id=null` como key no React; o ✕ nas padrão vinha de guarda baseada em `usuario_id` (campo que a resposta não tem). Fix frontend: key composta estável + ✕ por `is_padrao` + grid filtrado por tipo. **Não** se fez dedupe por id (colapsaria as padrão).
- **Barra de limite do cartão referencia o mês de fatura errado** (mostra total de Julho num contexto de Junho corrente). Número de dinheiro errado na tela — provável off-by-one em `fatura_aberta_total`/mês da fatura aberta. Cross-repo (provável backend).

---

## Web-Batch 1 — Concluído ✅ (11/06/2026)

| Item | O que foi feito |
|---|---|
| FE-01 | `AssistantPage.tsx`: removido import morto `clearHistorico`; `useState<string>(() => crypto.randomUUID())` no `sessaoId`. `npm run build` verde. |
| FE-01 (guarda) | Husky instalado (`prepare: husky` no package.json); `.husky/pre-push` roda `npm run build` antes de todo push. O `pre-commit` padrão do `husky init` (`npm test`) foi removido — não há script de teste. |
| FE-06 | `api.ts`: em `import.meta.env.PROD`, `throw` explícito se `VITE_API_URL` ausente (dev mantém fallback localhost). **Efeito colateral conhecido:** build local sem a variável gera bundle reduzido (~282 kB vs ~1.014 kB) porque o bundler elimina código após o throw incondicional — o dist resultante lança erro no load, que é o comportamento desejado. Na Vercel, configurar `VITE_API_URL` torna o bundle normal. |
| FE-03 | `react-router-dom` 6.30.3 → **6.30.4** (fix do open redirect GHSA-2j2x-hqr9-3h42). `npm audit`: 0 vulnerabilidades. Build verde após update. |
| FE-20 | Botões "Exportar" sem implementação **ocultados**: `SummaryPage` (const `exportBtn` + 2 usos removidos) e cadeia `CardsPage → InvoicePanel → InvoiceDetail` (`handleExport`, prop `onExport` e botão "Exportar fatura" removidos). **Export PDF de fatura / relatório = feature pós-launch** (re-introduzir os botões junto com a implementação). Obs.: `Hivvo_Referencia.md` §3 ainda lista "exportar fatura em PDF"/"exportar relatório" como implementados — corrigir na próxima sincronização da doc canônica. |

Não tocados (outros batches): FE-08, FE-02 (vercel.json/headers), FE-09 (strict TS) e demais.

---

## Web-Batch 2 — Concluído ✅ (11/06/2026)

| Item | O que foi feito |
|---|---|
| FE-02a | Inter self-hosted: `@fontsource/inter` (pesos 400 e 500, woff2 por subset com `unicode-range`, `font-display: swap`), imports em `main.tsx`; removidos os `preconnect` e o `<link>` do Google Fonts do `index.html`. Zero referências a `fonts.googleapis`/`gstatic` no dist. **Nota:** há 16 usos de `font-semibold` (600) no código — o browser sintetiza o 600 a partir do 500 (faux bold). Se o 600 real for desejado, adicionar `import '@fontsource/inter/600.css'`. |
| FE-02b | `vercel.json` criado: CSP restritiva (`default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `connect-src 'self' https://api.hivvo.app`, `frame-ancestors 'none'` etc.), `Referrer-Policy: no-referrer`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, HSTS, `Permissions-Policy` mínima; `/sw.js` com `Cache-Control: public, max-age=0, must-revalidate` (anti SW zumbi). **Atenção:** `connect-src` fixa `https://api.hivvo.app` — se a topologia/domínio da API mudar (decisão pendente no gate de deploy), atualizar o `vercel.json` junto com `VITE_API_URL`. |
| FE-02c | Verificado: vite-plugin-pwa injeta `<script src="/registerSW.js">` (arquivo externo, compatível com `script-src 'self'`) — **nenhuma mudança necessária**; `autoUpdate` mantido. |
| FE-04 | `ResetPasswordPage`: token capturado uma única vez (initializer do `useState`) e removido da URL no mount (`history.replaceState`); submit usa só o estado; `useSearchParams` removido. Combina com `Referrer-Policy: no-referrer`. Contraparte backend (F-25) fora deste batch. |

**Verificação:** build verde; dist servido com `vite preview` e smoke-test HTTP 200 em `/`, `/sw.js`, `/registerSW.js`, manifest, CSS e fontes; varredura estática: zero scripts inline no HTML, zero URLs externas no CSS. **Pendente de validação manual em browser:** zero violações de CSP no console (os headers só são aplicados na Vercel — `vite preview` não lê `vercel.json`), Recharts renderizando, fluxo de reset com URL limpa.

---

## Web-Batch 4 — Concluído ✅ (25/06/2026)

Liga o frontend ao endpoint dedicado `POST /ai/suggest-category` (já existente no backend, stateless, sem persistir em `chat_messages`) e **remove o caminho antigo** que reusava `POST /ai/chat` para sugerir categoria — a causa-raiz da poluição do histórico do Assistente (FE-08).

| Item | O que foi feito |
|---|---|
| FE-08 (cliente) | `ai.ts`: `suggestCategory(descricao, tipo, valor?)` agora chama `POST /ai/suggest-category` (path relativo, base via `VITE_API_URL`) e retorna `{categoria}`. **Não reusa** `sendMessage` nem `/ai/chat`; não gera `sessao_id` nem persiste no banco. `valor` enviado apenas quando `> 0` (`toFixed(2)`). |
| FE-08 (página) | `AddTransactionPage`: removida toda a lógica de sugestão via `sendMessage`. Eliminado o `useDebounce` + `useEffect` que disparava a cada digitação. A sugestão agora dispara **no `onBlur`** do campo de descrição, e **só se a descrição não estiver vazia**. Envia o `tipo` corrente (receita/despesa) para o backend filtrar as categorias. |
| FE-19 | Guarda contra resposta obsoleta: token de sequência `suggestSeq` (useRef). Um disparo novo invalida o anterior — resposta velha **não sobrescreve**. O `suggestSeq` também é incrementado no "Salvar e adicionar outro" para descartar sugestão em voo do form anterior. |
| Escolha manual | A sugestão só preenche a categoria se o usuário ainda **não** escolheu (`if (!getValues('categoria'))`); uma escolha manual feita antes ou durante a chamada nunca é sobrescrita. O badge "✦ IA" continua marcando a sugestão na grade. |

**Verificação:** `npm run build` verde; grep confirma zero referências a `sendMessage`/`ai/chat` no caminho de sugestão (permanecem apenas no fluxo legítimo do chat do Assistente em `ai.ts`/`AssistantPage.tsx`); disparo no blur, não na digitação. **Não tocados:** FE-08-backend (já feito), headers, `strict` do TS, demais batches.

---

## Web-Batch 3 — Concluído ✅ (26/06/2026)

Cluster de categorias — **frontend-only**. Investigação read-only no hivvo-api concluiu que `GET /categories` está correto e consistente: 15 padrão sintéticas (`id=null`, `is_padrao=true`), custom com `id` real (`is_padrao=false`), cada item com `tipo`; a resposta **não** inclui `usuario_id`; as duas "Outros" (despesa + receita) são legítimas. **Decisão fixa: NÃO deduplicar por id** (colapsaria as 15 padrão) — a correção é key estável + filtro por tipo.

| Sintoma | O que foi feito |
|---|---|
| 1 — *key collision* (id=null em todas as padrão) | Key composta estável em todo `.map` de objeto `Category`: `cat.is_padrao ? `padrao:${cat.tipo}:${cat.nome}` : cat.id`. Aplicado em `AddTransactionPage` (CategoryGrid) e `SettingsPage` (Gerenciar categorias, 2 ramos). As listas de filtro (`TransactionsPage`) e o `<select>` do `EditTransactionModal` já são keyed pelo **nome** (string) — sem colisão, sem mudança. |
| 2 — ✕ nas categorias padrão (regressão `f55c4df`) | `SettingsPage`: condição do ✕ trocada de `cat.usuario_id !== null` (campo inexistente → sempre `true`) para `!cat.is_padrao`. Excluir aparece só em categoria custom. Guarda extra no handler (`if (cat.id == null) return`) já que `id` agora pode ser null. |
| 3 — receita selecionável sob Tipo = Despesa | `AddTransactionPage`: grid usa `visibleCategories = categories.filter(c => c.tipo === tipo)` (client-side, sem refetch ao alternar o toggle). **Gerenciar categorias (Settings) não filtra** — lá os dois tipos aparecem. `EditTransactionModal` não filtrado (recebe `string[]` de nomes sem `tipo` e mistura categorias das transações — filtrar arriscaria esconder a categoria atual). |
| Higiene de tipo | `Category` alinhado ao contrato real: `id: number \| null`, `nome`, `icone`, `tipo`, `ativa`, `is_padrao`, `criado_em`. Removidos `usuario_id` (fantasma, origem do sintoma 2) e `cor` (sem uso). Nenhum uso novo de `usuario_id` introduzido. |

**Verificação:** `npm run build` verde; `grep usuario_id src/` retorna apenas um comentário (zero lógica de UI dependente do campo); key composta em todos os `.map` de objeto `Category`. **Não tocados:** FE-08/sugestão (já feito), headers, `strict` do TS global, demais batches.

---

## Testes — Estado Real

⚠️ **Não há suíte de testes automatizada no frontend.** Os "Blocos 1–5" foram **testes manuais E2E**. O único gate automatizado é `npm run build` (`tsc -b && vite build`) — verde desde o Web-Batch 1 e agora aplicado automaticamente via hook pre-push (husky). Validação assistida pelo Claude Chrome (testador) complementa os testes manuais.

| Bloco (manual E2E) | Escopo | Status |
|---|---|---|
| Bloco 1 | Autenticação | ✅ |
| Bloco 2 | Dashboard e Transações | ✅ |
| Bloco 3 | Cartões, Faturas e Parcelas | ✅ |
| Bloco 4 | Assistente IA, CSV, Backup, Configurações | ✅ |
| Bloco 5 | Build/PWA/qualidade | ✅ (regressão FE-01 corrigida no Web-Batch 1; pre-push agora impede nova regressão) |

**Pendências de validação runtime** (Chrome não cobriu, ou condições não ocorreram): guarda de rota deslogado + refresh em 401, token de reset na URL (FE-04), layout mobile real (device toolbar), 503 do Gemini / resposta longa quebrando chat, variação com saldo anterior negativo.

---

## Próximos Passos

1. **Hardening pré-deploy (workstream ativo):** executar `PLANO_EXECUCAO_WEB.md` na ordem — Web-Batches 1 e 2 ✅; seguir para o Web-Batch 3.
2. **Deploy (gated):** Vercel — `VITE_API_URL` apontando para o backend (com `/api/v1` quando o backend migrar), headers via `vercel.json`, PWA instalável. **Coordenar a topologia com o backend** (`app.hivvo.app` / `api.hivvo.app`, cookie `Domain=.hivvo.app`).
3. **UX Fase 3 (pode interlevar pós-deploy):** unificar formulários de transação, destacar toggle "Parcelar compra", reorganizar Configurações, value proposition no login.
4. **Lançamento:** landing page, Product Hunt/LinkedIn, Posthog, limites do plano gratuito.

---

## Implementado — Assistente IA com Persistência e Memória ✅ (frontend)

- `ai.ts`: `getHistorico()` (GET /ai/historico), `sendMessage()` sem histórico no payload, `sessao_id` por conversa.
- `AssistantPage.tsx`: carrega histórico no mount; append otimista; "Nova conversa" gera novo `sessao_id` (UI limpa).
- Comportamento: 1ª vez → IA se apresenta; < 24h → mostra sessão; > 24h → UI limpa, contexto invisível de 50 msgs.
- **FE-08 resolvido no cliente (Web-Batch 4):** a sugestão de categoria não passa mais por `/ai/chat`; usa o endpoint dedicado stateless `POST /ai/suggest-category`. O fluxo do Assistente não é mais contaminado pela digitação na tela de Adicionar transação. Revalidar o histórico completo ao reabrir o Assistente.

---

## Decisões Fixas (não discutir)

- **Frontend:** React + Vite + TypeScript + Tailwind CSS · Zustand (UI) + TanStack Query (servidor) · React Router v6 · Recharts · Vite PWA Plugin · Deploy Vercel
- **Backend (referência):** FastAPI + SQLModel + PostgreSQL (Supabase) · JWT httpOnly cookie
- **Tema:** escuro (#1A1714) · **Cor primária:** âmbar (#EF9F27)

---

## Regras de Implementação (não-negociáveis)

1. Nunca hardcodar cores — tokens do Tailwind
2. Nunca CSS responsivo puro — `MobileLayout` vs `DesktopLayout` via `useBreakpoint`
3. Dados de servidor: TanStack Query. Estado de UI: Zustand. Nunca misturar. *(exceção documentada: histórico do chat em useState — FE-18)*
4. Componentes UI base em `src/components/ui/`, reutilizados
5. Um arquivo em `src/services/` por endpoint
6. Valores monetários: `toFixed(2)` no envio; `Intl.NumberFormat pt-BR` na exibição
7. JWT nunca em localStorage — só cookie httpOnly/memória
8. Uma tarefa/batch por vez; `npm run build` deve passar antes de concluir; atualizar este `SESSAO_ATUAL.md` ao fim

---

## Decisões Técnicas Tomadas

| Decisão | Detalhes |
|---|---|
| Zod v4 coerce + RHF | `z.coerce.number()` + `.refine()` + cast `as Resolver<z.infer<typeof schema>>`. |
| Recharts formatter | Parâmetros `unknown` com cast interno. |
| Refresh token — interceptor | `isRefreshing` + `failedQueue` serializam 401s; falha → `clearAuth()` + redirect `/login`. *(FE-05: ignorar URLs de auth público + flag `_retry` — pendente.)* |
| `Input.showToggle` | Estado `visible` local; `tabIndex={-1}` no botão do olho. |
| `Button.variant="danger"` | Outline `border-danger`. *(FE-28: falta um `danger-solid` para unificar modais.)* |
| OnboardingBanner dismiss | `localStorage` `hivvo_onboarding_dismissed` (único uso de localStorage no app). |
| Vírgula decimal em `valor` | `parseFloat(String(v).replace(',', '.'))` no payload. |
| `username` auto-gerado | Removido do cadastro; backend gera. |
| Badge parcela inline | `total_parcelas` do backend; badge `Nx`. |
| Barra de limite CardVisual | `fatura_aberta_total` de `CartaoComFaturaResponse`. *(Chrome: está exibindo o mês de fatura errado — investigar.)* |

---

## Histórico de Construção (resumo)

Todas as telas concluídas: Login/Cadastro → Dashboard → Transações → Adicionar (parcelamento) → Cartões/Faturas → Assistente IA → Resumo detalhado → features secundárias (CSV, backup, categorias, perfil) → recuperação de senha → renomeação BeeFree→Hivvo → Termos/Privacidade → melhorias UI/UX #1–#10 → Assistente IA com persistência → botão "Resetar Assistente" (`7a5ce86`).

### Bugfixes relevantes (referência)
`a66c92d` toFixed/`R$ NaN` (string do backend) · `07d476b` Zod v4 + zodResolver cast · `15798da` ícones PWA · `f55c4df` error handling + emoji em categorias + **guarda `usuario_id !== null` no botão excluir** *(Chrome detectou regressão — ver cluster de categorias)* · `41522d5` Toast global · `a059122` normalização de valor + toasts de erro nos forms · `38f1f61` voltar com `navigate(-1)` nas páginas legais · `3e577a7` `username` removido do cadastro · `6f6ed86` Exportar fatura `disabled` em fatura vazia.

> **Changelog detalhado de arquivos por tarefa:** no histórico do git. (As listas exaustivas de paths foram removidas deste doc para mantê-lo acionável; decisões preservadas acima.)

---

*Última atualização: 26 de junho de 2026 — FE-12 concluído (invalidação de cache de cartões/faturas/compromissos nas mutations de transação: +`['cards']`/`['invoices']`/`['invoice-detail']`/`['installments']`). Build verde. Web-Batches 1, 2, 3 e 4 + FE-12 concluídos; próximo: itens pré-deploy restantes do `PLANO_EXECUCAO_WEB.md`.*
*Projeto: Hivvo — gestão financeira pessoal com IA · Repositório FinanceAI original: github.com/lucasdonnangelo/financeai*
