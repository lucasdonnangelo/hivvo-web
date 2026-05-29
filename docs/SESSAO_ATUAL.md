# BeeFree — Sessão Atual

## Antes de começar
Leia os arquivos `docs/BeeFree_Referencia.md` e `docs/SESSAO_ATUAL.md` para entender o produto, a arquitetura e as decisões de stack. Não proponha alternativas de tecnologia — as escolhas já foram feitas.

---

## Estado do Projeto

**Fase atual:** Fase 2 — Frontend React PWA (base)  
**Próxima tarefa:** #17 — Features secundárias (CSV, backup, categorias, perfil)  
**Última tarefa concluída:** #16 — Ver resumo detalhado (frontend)

---

## Decisões Fixas (não discutir)

- **Backend:** FastAPI + SQLModel + PostgreSQL (Supabase)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Estado:** Zustand (UI) + TanStack Query (servidor)
- **Roteamento:** React Router v6
- **Gráficos:** Recharts
- **PWA:** Vite PWA Plugin
- **Deploy backend:** Railway ou Render (free tier)
- **Deploy frontend:** Vercel
- **Autenticação:** JWT (httpOnly cookie)
- **Tema:** Escuro por padrão (#1A1714)
- **Cor primária:** Âmbar (#EF9F27)

---

## Ordem de Implementação

- [x] 1. Estrutura FastAPI + conexão Supabase + health check
- [x] 2. Migrar models.py + migrations Alembic
- [x] 3. Endpoints de auth (registro + login + JWT)
- [x] 4. Endpoints de transações e categorias
- [x] 5. Endpoints de cartões e faturas
- [x] 6. Endpoints de parcelas
- [x] 7. Endpoints de estatísticas
- [x] 8. Endpoint de IA (proxy Gemini)
- [x] 9. Setup React + Vite + Tailwind + PWA + layouts
- [x] 10. Login + Cadastro (frontend)
- [x] 11. Dashboard (frontend)
- [x] 12. Transações (frontend)
- [x] 13. Adicionar transação com parcelamento (frontend)
- [x] 14. Cartões e faturas (frontend)
- [x] 15. Assistente IA (frontend)
- [x] 16. Ver resumo detalhado (frontend)
- [ ] 17. Features secundárias (CSV, backup, categorias, perfil)

---

## Decisões Técnicas Tomadas

| Decisão | Detalhes |
|---|---|
| `passlib` removido | Incompatível com `bcrypt >= 4.0`. Usando `bcrypt` diretamente. |
| `fatura_mes`/`fatura_ano` | Derivados da `data_vencimento` da parcela, não da data da compra. |
| Routers sem trailing slash | Endpoints raiz usam `""` em vez de `"/"` para evitar redirect 307. |
| Soft delete em categorias | `ativa=False` em vez de DELETE para preservar histórico de transações. |
| Parcelamento sem cartão | Usa intervalos mensais simples a partir da data da compra. |
| Arredondamento de parcelas | Última parcela absorve diferença de arredondamento (`ROUND_HALF_UP`). |

---

## Arquivos Criados/Modificados por Tarefa

### Tarefa #1 — Estrutura base
- `main.py` — FastAPI app, CORS, routers, GET /health
- `app/core/config.py` — Settings via pydantic-settings
- `app/core/database.py` — engine + get_session
- `requirements.txt` — dependências

### Tarefa #2 — Models + Alembic
- `app/models/user.py` — Usuario (email, username, senha_hash, rate limiting)
- `app/models/card.py` — Cartao (dia_vencimento, dia_fechamento, mes_offset_vencimento)
- `app/models/transaction.py` — Transacao (tipo receita/despesa, usuario_id FK)
- `app/models/category.py` — CategoriaCustomizada
- `app/models/installment.py` — Parcela (FK transacao + cartao + usuario)
- `alembic/env.py`, `alembic.ini`, `alembic/script.py.mako`
- Migration: `abdb546095c0_initial_schema.py` — aplicada no Supabase

### Tarefa #3 — Auth
- `app/core/auth.py` — hash_password, verify_password (bcrypt direto), create_access_token, get_current_user
- `app/schemas/auth.py` — RegisterRequest, LoginRequest, UserResponse
- `app/routers/auth.py` — POST /register, POST /login, POST /logout, GET /me

### Tarefa #4 — Transações e Categorias
- `app/schemas/transaction.py` — TransacaoCreate, TransacaoUpdate, TransacaoResponse, TransacaoCreateResponse
- `app/schemas/category.py` — CategoriaCreate, CategoriaResponse
- `app/routers/transactions.py` — GET/POST/PUT/DELETE + lógica de parcelamento
- `app/routers/categories.py` — GET/POST/DELETE + 15 categorias padrão hardcoded

### Tarefa #5 — Cartões e Faturas
- `app/schemas/card.py` — CartaoCreate, CartaoUpdate, CartaoResponse, CartaoComFaturaResponse
- `app/schemas/invoice.py` — ParcelaFaturaResponse, TransacaoFaturaResponse, FaturaListItem, FaturaDetalhe
- `app/routers/cards.py` — GET/POST/PUT/DELETE + fatura aberta calculada em tempo real
- `app/routers/invoices.py` — GET /{card_id}/invoices (lista), GET /{card_id}/invoices/{ano}/{mes} (detalhe)

### Tarefa #6 — Parcelas
- `app/schemas/installment.py` — ParcelaUpdate, ParcelaResponse
- `app/routers/installments.py` — GET (filtros: cartao_id, pago, cancelado, mes, ano), PUT (marcar paga/cancelar), DELETE (individual)

### Tarefa #7 — Estatísticas
- `app/schemas/statistics.py` — CategoriaStats, MensalResponse, MesEvolucao, AnualResponse, CategoriasResponse
- `app/routers/statistics.py` — GET /statistics/monthly (receitas/despesas/saldo + categorias + variação % vs mês anterior), GET /statistics/yearly (12 meses, totais), GET /statistics/categories (breakdown por categoria com percentual)

### Tarefa #8 — IA (proxy Gemini)
- `app/schemas/ai.py` — ChatRequest (mensagem, mes, ano), ChatResponse (resposta)
- `app/routers/ai.py` — POST /ai/chat: busca contexto via helpers de statistics.py (sem duplicar), injeta saldo/receitas/despesas/top5 categorias/parcelas do próximo mês/nº transações no prompt, chama Gemini via google-genai, retorna 503 claro em caso de falha

### Tarefa #16 — Ver Resumo Detalhado (frontend)
- `src/services/statistics.ts` — expandido: `MesEvolucao`, `AnualResponse`, `CategoriasResponse`; `getYearlyStats(ano)`, `getCategoryStats({ mes?, ano })`
- `src/services/installments.ts` — novo: `ParcelaResponse`, `getInstallments(params)`
- `src/hooks/useStatistics.ts` — expandido: `useYearlyStats`, `useCategoryStats`, `useQuarterlyStats` (agrega 3 meses via `useQueries`, mescla categorias, recalcula percentuais)
- `src/hooks/useInstallments.ts` — novo: `useInstallments(mes, ano)` para parcelas do próximo mês
- `src/components/charts/BarChart.tsx` — novo: Recharts `BarChart` agrupado receitas/despesas, YAxis com formato BRL compact, `highlightMeses` prop (reservada para uso futuro)
- `src/pages/Transactions/SummaryPage.tsx` — página completa:
  - Toggle Mês / Trimestre / Ano com snap automático para início do trimestre
  - Navegação de período (mês, trimestre por 3 meses, ano) bloqueada no período atual
  - 4 cards: Receitas, Despesas, Saldo Líquido (cor semântica), Parcelas — Próx. Mês (âmbar)
  - Comparativo `variacao_%` vs período anterior: backend fornece para Mês; Ano calculado com prevYearly; Trimestre retorna null (sem fetch adicional do trimestre anterior)
  - DonutChart reutilizado por categoria
  - BarChart de evolução mensal: Ano usa todos os 12 meses, Trimestre filtra os 3 meses do quarter, Mês usa dados do ano inteiro com mês atual destacável
  - TopCategorias: lista top 6 com barra de progresso proporcional ao percentual
  - Botão exportar (placeholder)
  - Empty state quando receitas + despesas = 0
  - Skeleton de loading para mobile e desktop
  - Botão ← volta para `/transactions`
- `src/App.tsx` — rota `/transactions/summary` adicionada (irmã de `/transactions`, recebe AppLayout)
- `src/pages/Transactions/TransactionsPage.tsx` — botão "Ver resumo →" no mobile (header) e desktop (topbar)

### Tarefa #15 — Assistente IA (frontend)
- `src/services/ai.ts` — refatorado: `sendMessage(mensagem, mes, ano)` extraído como função base; `suggestCategory` passa a usá-la internamente
- `src/pages/Assistant/AssistantPage.tsx` — página completa:
  - Estado local `Message[]` (`id`, `role`, `text`) — sem persistência no backend
  - `handleSend`: push user msg → POST `/ai/chat` → push assistant msg; erro → mensagem de fallback
  - `TypingIndicator`: 3 dots com `animate-bounce` staggerado (0 / 150ms / 300ms)
  - `MessageBubble`: user à direita (bg-amber/15, border-amber/30), IA à esquerda (bg-bg-surface) com ícone ✦
  - `EmptyState`: ícone âmbar + texto + chips verticais (apenas mobile); desktop mostra painel lateral com sugestões
  - `ChatInput`: textarea (Enter envia, Shift+Enter quebra linha), botão seta âmbar
  - `StatsPanel` (desktop): `useMonthlyStats` do mês corrente — receitas/despesas/saldo + top 4 categorias com barra de percentual + lista de perguntas rápidas
  - Mobile: chips de perguntas rápidas enviam imediatamente; Desktop: chips preenchem o input
  - `useEffect` em `messages` → `scrollIntoView` automático no fim da lista
- `src/App.tsx` — placeholder `Assistant` substituído por `AssistantPage`

### Tarefa #14 — Cartões e faturas (frontend)
- `src/services/cards.ts` — expandido: tipos `CardPayload`, `InvoiceListItem`, `ParcelaFaturaItem`, `TransacaoFaturaItem`, `InvoiceDetail`; funções `createCard`, `updateCard`, `deactivateCard` (PUT com `ativo: false`), `getInvoices`, `getInvoiceDetail`
- `src/hooks/useCards.ts` — expandido: `useCreateCard`, `useUpdateCard`, `useDeactivateCard`, `useInvoices` (enabled quando cardId != null), `useInvoiceDetail`
- `src/components/cards/CardVisual.tsx` — visual do cartão: gradiente amber-dark→amber→amber-light, nome, limite, tipo; prop `selected` com ring âmbar
- `src/components/cards/CardFormModal.tsx` — modal RHF+Zod: nome, limite, tipo (select), dia_fechamento, dia_vencimento, mes_offset_vencimento (select "mesmo mês / mês seguinte")
- `src/components/cards/InvoiceMonthGrid.tsx` — grid 6×2 de meses; mês selecionado em âmbar; meses futuros opacos; exibe valor abreviado por mês
- `src/components/cards/InvoiceDetail.tsx` — detalhe da fatura: total, data de vencimento, seção "Parcelas" com badge `X/Y` âmbar, seção "Avulsas"; botão exportar (placeholder)
- `src/pages/Cards/CardsPage.tsx` — página completa:
  - Mobile: header + carrossel scroll-snap + botões editar/desativar + InvoicePanel
  - Desktop: painel esquerdo 288px (lista de cartões + ações) + painel direito (InvoicePanel)
  - `DeactivateModal` com confirmação e botão danger
  - `InvoicePanel` encapsula `useInvoices` + `useInvoiceDetail` + `InvoiceMonthGrid` + `InvoiceDetailPanel`
  - Empty state com CTA quando não há cartões ativos
- `src/App.tsx` — placeholder `Cards` substituído por `CardsPage`

### Tarefa #13 — Adicionar transação com parcelamento (frontend)
- `src/services/ai.ts` — `suggestCategory(descricao, categorias[])`: POST `/ai/chat` com prompt direcionado; valida que a resposta é uma categoria existente; retorna null em caso de falha
- `src/hooks/useCards.ts` — `useCards()` via TanStack Query, `staleTime` 5 min
- `src/services/transactions.ts` — `TransactionCreatePayload` (inclui `num_parcelas?: number`); `createTransaction` atualizado para usar o novo tipo
- `src/hooks/useTransactions.ts` — `useCreateTransaction`: mutation com invalidação de `['transactions']` e `['statistics','monthly']` (sem mes/ano para invalidar todas as queries)
- `src/pages/AddTransaction/AddTransactionPage.tsx` — página completa:
  - Tipo: toggle Despesa/Receita com cores semânticas (danger/success)
  - Valor: input numérico step 0.01
  - Descrição: debounce 500ms → `suggestCategory()` → badge `✦ IA` na categoria sugerida
  - Categoria: `CategoryGrid` 4 colunas com ícone + nome + badge IA; usa `Controller` do RHF
  - Data: date input com default = hoje (data local)
  - Forma de pagamento: chips pill com `Controller`
  - Cartão: `Controller` com select filtrado (credito|ambos); se lista vazia → mensagem "Nenhum cartão cadastrado. Adicione um na aba Cartões."
  - Parcelamento: toggle switch âmbar; visível apenas se Crédito + cartão selecionado; oculto (e form reset) se não há cartões
  - Num. parcelas: input 2–24; valor por parcela calculado em tempo real
  - `canSubmit`: `isValid && !isPending && (!isCredito || !hasCards || cartao_id != null)`
  - Salvar → `navigate('/dashboard')`; Salvar e adicionar outro → `reset()` mantendo tipo/data/forma_pagamento
  - Mobile: tela cheia com header + scroll + footer fixo com os dois botões
  - Desktop: grid `[1fr 300px]` form + `ImpactPreview` sticky com tipo, valor, descrição, categoria, saldo estimado
- `src/App.tsx` — placeholder `AddTransaction` substituído por `AddTransactionPage`

### Tarefa #12 — Transações (frontend)
- `src/services/categories.ts` — `Category` type + `getCategories()`
- `src/hooks/useCategories.ts` — `useCategories()` via TanStack Query, `staleTime` 5 min
- `src/hooks/useTransactions.ts` — adicionados `useDeleteTransaction` e `useUpdateTransaction` com invalidação de `['transactions']` e `['statistics','monthly']`
- `src/components/ui/Modal.tsx` — modal reutilizável: overlay, título, slot `footer`, fecha com Esc ou clique fora
- `src/components/transaction/TransactionItem.tsx` — linha de transação: descrição, categoria, forma de pag., badge "Parcelado", valor colorido, botões editar/deletar
- `src/components/transaction/TransactionGroup.tsx` — grupo por data com header "Hoje / Ontem / dia mês" e subtotal do grupo
- `src/components/transaction/DeleteConfirmModal.tsx` — confirmação de exclusão com botão danger e spinner
- `src/components/transaction/EditTransactionModal.tsx` — formulário RHF+Zod; se `tx.parcelado === true`, exibe aviso âmbar e oculta campos/salvar
- `src/pages/Transactions/TransactionsPage.tsx` — página completa: filtros client-side, busca, agrupamento por data, total filtrado, layouts distintos mobile (chips + modal filtros) e desktop (painel lateral 256px)
- `src/App.tsx` — placeholder `Transactions` substituído por `TransactionsPage`

### Tarefa #11 — Dashboard (frontend)
- `src/services/statistics.ts` — tipos `CategoriaStats`, `MonthlyStats` + `getMonthlyStats(mes, ano)`
- `src/hooks/useStatistics.ts` — `useMonthlyStats` via TanStack Query, queryKey `['statistics','monthly', mes, ano]`
- `src/components/charts/DonutChart.tsx` — Recharts PieChart/donut, paleta 6 cores do brand guide, legenda com Tailwind classes, tooltip estilizado
- `src/pages/Dashboard/DashboardPage.tsx` — navegação entre meses, MetricCard (saldo/receitas/despesas + variação%), DonutChart, últimas 5 transações, empty state, skeleton, mobile e desktop via `useBreakpoint`
- `src/App.tsx` — placeholder `Dashboard` substituído por `DashboardPage`

### Tarefa #10 — Login + Cadastro (frontend)
- `src/components/ui/Spinner.tsx` — SVG animado, prop `size`, usado internamente pelo Button
- `src/components/ui/Button.tsx` — variantes `primary`/`ghost`, prop `isLoading` com Spinner, `disabled` automático
- `src/components/ui/Input.tsx` — `forwardRef`, props `label` e `error`, borda `border-danger` em erro
- `src/pages/Auth/LoginPage.tsx` — RHF + Zod (email + senha min 8), `mode: 'onChange'`, chama `login()` → `setUser()` → `/dashboard`
- `src/pages/Auth/RegisterPage.tsx` — RHF + Zod (email + username + senha min 8 + confirmação com `.refine()`), chama `register()` → `login()` → `setUser()` → `/dashboard`
- `src/App.tsx` — `AuthInitializer` (restaura sessão via `getMe()` no mount), `ProtectedRoute` (redireciona para `/login` se não autenticado), rotas reais importadas

### Tarefa #9 — Setup Frontend (beefree-web/)
- `vite.config.ts` — PWA plugin configurado com manifest BeeFree
- `tailwind.config.ts` — tokens de cor/tipografia do brand guide (amber, bg, text, success, danger)
- `index.html` — Inter font, lang=pt-BR, theme-color=#1A1714
- `src/index.css` — @tailwind directives + reset de altura full-screen
- `src/styles/tokens.css` — variáveis CSS do brand guide
- `src/main.tsx` — QueryClientProvider + BrowserRouter + StrictMode
- `src/App.tsx` — React Router v6: AppLayout escolhe Mobile vs Desktop via useBreakpoint
- `src/layouts/MobileLayout.tsx` — header + Outlet + bottom tab bar com FAB central
- `src/layouts/DesktopLayout.tsx` — sidebar 52px (ícones) + Outlet
- `src/layouts/AuthLayout.tsx` — card centralizado no fundo escuro
- `src/hooks/useBreakpoint.ts` — useBreakpoint('md') → true em mobile (<768px)
- `src/store/authStore.ts` — Zustand: user, isAuthenticated, setUser, clearAuth
- `src/store/uiStore.ts` — Zustand: toasts, activeModal, isLoading
- `src/services/api.ts` — Axios com withCredentials + interceptor 401→clearAuth
- `src/services/auth.ts`, `transactions.ts`, `cards.ts` — stubs dos serviços
- `public/manifest.json` — PWA manifest estático
- `docs/` — cópias de BeeFree_Referencia.md e SESSAO_ATUAL.md

---

## Regras de Trabalho

1. **Uma tarefa por vez** — não avançar sem confirmação
2. **Sempre rodar testes** antes de marcar tarefa como concluída
3. **Nunca hardcodar cores** — usar sempre os tokens do brand guide
4. **Nunca misturar** TanStack Query com Zustand
5. **Layouts distintos** — MobileLayout e DesktopLayout, nunca CSS responsivo puro
6. **Valores monetários** — sempre Decimal no Python, toFixed(2) no JS
7. **JWT** — nunca em localStorage, apenas httpOnly cookie ou memória

---

## Estrutura de Pastas Atual (Backend)

```
beefree-api/
├── main.py
├── .env
├── requirements.txt
├── alembic.ini
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── abdb546095c0_initial_schema.py
└── app/
    ├── models/
    │   ├── user.py          ✓
    │   ├── card.py          ✓
    │   ├── transaction.py   ✓
    │   ├── category.py      ✓
    │   └── installment.py   ✓
    ├── schemas/
    │   ├── auth.py          ✓
    │   ├── transaction.py   ✓
    │   ├── category.py      ✓
    │   ├── card.py          ✓
    │   ├── invoice.py       ✓
    │   ├── installment.py   ✓
    │   └── statistics.py    ✓
    ├── routers/
    │   ├── auth.py          ✓
    │   ├── transactions.py  ✓
    │   ├── categories.py    ✓
    │   ├── cards.py         ✓
    │   ├── invoices.py      ✓
    │   ├── installments.py  ✓
    │   ├── statistics.py    ✓
    │   └── ai.py            ✓
    ├── repositories/        — vazio
    ├── services/            — vazio
    └── core/
        ├── auth.py          ✓
        ├── database.py      ✓
        └── config.py        ✓
```

---

## Estrutura de Pastas Atual (Frontend)

```
beefree-web/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── public/
│   └── manifest.json
└── src/
    ├── layouts/
    │   ├── DesktopLayout.tsx    ✓
    │   ├── MobileLayout.tsx     ✓
    │   └── AuthLayout.tsx       ✓
    ├── pages/
    │   ├── Dashboard/
    │   │   └── DashboardPage.tsx    ✓
    │   ├── Transactions/
    │   │   ├── TransactionsPage.tsx ✓
    │   │   └── SummaryPage.tsx      ✓
    │   ├── AddTransaction/
    │   │   └── AddTransactionPage.tsx   ✓
    │   ├── Cards/
    │   │   └── CardsPage.tsx        ✓
    │   ├── Assistant/
    │   │   └── AssistantPage.tsx    ✓
    │   ├── Auth/
    │   │   ├── LoginPage.tsx        ✓
    │   │   └── RegisterPage.tsx     ✓
    │   └── Settings/                — placeholder (Tarefa #17)
    ├── components/
    │   ├── ui/
    │   │   ├── Button.tsx           ✓
    │   │   ├── Input.tsx            ✓
    │   │   ├── Modal.tsx            ✓
    │   │   └── Spinner.tsx          ✓
    │   ├── charts/
    │   │   ├── DonutChart.tsx       ✓
    │   │   └── BarChart.tsx         ✓
    │   ├── transaction/
    │   │   ├── TransactionItem.tsx  ✓
    │   │   ├── TransactionGroup.tsx ✓
    │   │   ├── EditTransactionModal.tsx  ✓
    │   │   └── DeleteConfirmModal.tsx    ✓
    │   └── cards/
    │       ├── CardVisual.tsx       ✓
    │       ├── CardFormModal.tsx    ✓
    │       ├── InvoiceMonthGrid.tsx ✓
    │       └── InvoiceDetail.tsx    ✓
    ├── hooks/
    │   ├── useBreakpoint.ts         ✓
    │   ├── useTransactions.ts       ✓
    │   ├── useCategories.ts         ✓
    │   ├── useStatistics.ts         ✓
    │   ├── useCards.ts              ✓
    │   ├── useAuth.ts               ✓
    │   └── useInstallments.ts       ✓
    ├── store/
    │   ├── authStore.ts             ✓
    │   └── uiStore.ts               ✓
    ├── services/
    │   ├── api.ts                   ✓
    │   ├── auth.ts                  ✓
    │   ├── transactions.ts          ✓
    │   ├── categories.ts            ✓
    │   ├── cards.ts                 ✓
    │   ├── ai.ts                    ✓
    │   ├── statistics.ts            ✓
    │   └── installments.ts          ✓
    └── styles/
        └── tokens.css           ✓
```

---

*Última atualização: 29 de Maio de 2026 — Tarefa #16 concluída, iniciando Tarefa #17 (Features Secundárias)*  
*Projeto: BeeFree — gestão financeira pessoal com IA*  
*Repositório FinanceAI original: github.com/lucasdonnangelo/financeai*
