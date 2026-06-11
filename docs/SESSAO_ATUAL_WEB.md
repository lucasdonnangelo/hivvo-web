# Hivvo — Sessão Atual (hivvo-web)

## Antes de começar
Leia `docs/Hivvo_Referencia.md` (canônica, espelhada com o hivvo-api), `docs/SESSAO_ATUAL.md`, `docs/AUDITORIA_FRONTEND.md` e `docs/PLANO_EXECUCAO_WEB.md`. Não proponha alternativas de tecnologia — já decididas. Uma tarefa/batch por vez, com aprovação antes do commit.

> Este `SESSAO_ATUAL.md` é **específico do hivvo-web**. O hivvo-api tem o seu próprio. A `Hivvo_Referencia.md` é a única doc compartilhada (idêntica nos dois repos).

---

## Estado do Projeto

**Fase atual:** Hardening pré-deploy (frontend)
**Status:** Frontend feature-complete e funcional. Em 11/06/2026 passou por duas auditorias — código (`AUDITORIA_FRONTEND.md`, 29 achados) e renderizado (log do Claude Chrome). O trabalho ativo é executar o `PLANO_EXECUCAO_WEB.md` antes do deploy.
**⚠️ Bloqueador imediato:** o **build de produção está quebrado** (`npm run build` falha com 2 erros de TypeScript em `AssistantPage.tsx` — FE-01). O deploy na Vercel falharia hoje. É o primeiro item do plano e é trivial.
**Próximo passo imediato:** Web-Batch 1 do plano (corrigir build + higiene crítica).

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
- **Cluster de categorias** (provável raiz compartilhada): categoria "Outros" **duplicada** (mesmo id → flood de ~500 erros de *key collision* no React + tiles repetidas); categorias **padrão exibindo botão de excluir (✕)** — regressão do fix `f55c4df`; categorias de **receita selecionáveis com Tipo = Despesa** (lista não filtrada por tipo). Cross-repo (checar `GET /categories` no backend).
- **Barra de limite do cartão referencia o mês de fatura errado** (mostra total de Julho num contexto de Junho corrente). Número de dinheiro errado na tela — provável off-by-one em `fatura_aberta_total`/mês da fatura aberta. Cross-repo (provável backend).

---

## Testes — Estado Real

⚠️ **Não há suíte de testes automatizada no frontend.** Os "Blocos 1–5" foram **testes manuais E2E**. O único gate automatizado é `npm run build` (`tsc -b && vite build`) — e ele está **quebrado** hoje (FE-01). Validação assistida pelo Claude Chrome (testador) complementa os testes manuais.

| Bloco (manual E2E) | Escopo | Status |
|---|---|---|
| Bloco 1 | Autenticação | ✅ |
| Bloco 2 | Dashboard e Transações | ✅ |
| Bloco 3 | Cartões, Faturas e Parcelas | ✅ |
| Bloco 4 | Assistente IA, CSV, Backup, Configurações | ✅ |
| Bloco 5 | Build/PWA/qualidade | ✅ (mas o build regrediu — FE-01) |

**Pendências de validação runtime** (Chrome não cobriu, ou condições não ocorreram): guarda de rota deslogado + refresh em 401, token de reset na URL (FE-04), layout mobile real (device toolbar), 503 do Gemini / resposta longa quebrando chat, variação com saldo anterior negativo.

---

## Próximos Passos

1. **Hardening pré-deploy (workstream ativo):** executar `PLANO_EXECUCAO_WEB.md` na ordem, começando pelo build (FE-01).
2. **Deploy (gated):** Vercel — `VITE_API_URL` apontando para o backend (com `/api/v1` quando o backend migrar), headers via `vercel.json`, PWA instalável. **Coordenar a topologia com o backend** (`app.hivvo.app` / `api.hivvo.app`, cookie `Domain=.hivvo.app`).
3. **UX Fase 3 (pode interlevar pós-deploy):** unificar formulários de transação, destacar toggle "Parcelar compra", reorganizar Configurações, value proposition no login.
4. **Lançamento:** landing page, Product Hunt/LinkedIn, Posthog, limites do plano gratuito.

---

## Implementado — Assistente IA com Persistência e Memória ✅ (frontend)

- `ai.ts`: `getHistorico()` (GET /ai/historico), `sendMessage()` sem histórico no payload, `sessao_id` por conversa.
- `AssistantPage.tsx`: carrega histórico no mount; append otimista; "Nova conversa" gera novo `sessao_id` (UI limpa).
- Comportamento: 1ª vez → IA se apresenta; < 24h → mostra sessão; > 24h → UI limpa, contexto invisível de 50 msgs.
- **Atenção:** o FE-08 contamina esse fluxo (sugestão de categoria gravando no histórico). Resolver antes de validar de novo.

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

*Última atualização: 11 de junho de 2026 — Fase migrada para Hardening pré-deploy (frontend) após auditorias de código e do Chrome. Build quebrado (FE-01) é o bloqueador imediato. Plano em `docs/PLANO_EXECUCAO_WEB.md`. FE-08 identificado como causa do mistério do histórico do Assistente.*
*Projeto: Hivvo — gestão financeira pessoal com IA · Repositório FinanceAI original: github.com/lucasdonnangelo/financeai*
