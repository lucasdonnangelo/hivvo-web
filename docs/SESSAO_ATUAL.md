# BeeFree — Sessão Atual

## Antes de começar
Leia os arquivos `docs/BeeFree_Referencia.md` e `docs/SESSAO_ATUAL.md` para entender o produto, a arquitetura e as decisões de stack. Não proponha alternativas de tecnologia — as escolhas já foram feitas.

---

## Estado do Projeto

**Fase atual:** Refinamentos de UX e novas features de autenticação  
**Status:** Todos os testes (Blocos 1–5) concluídos. Bugs #1–#5 corrigidos e commitados.  
**Próximo passo imediato:** (1) Recuperação de senha por e-mail via Resend; (2) Refresh token  
**Próxima fase:** Deploy — backend no Railway/Render, frontend no Vercel  
**Última tarefa concluída:** Bugs #1–#5 — refinamentos de UX (Settings, categorias, emoji, empty state, toast)

---

## Testes — Estado Atual

| Bloco | Escopo | Status | Observações |
|---|---|---|---|
| Bloco 1 | Autenticação (registro, login, logout, sessão persistida) | ✅ Concluído | — |
| Bloco 2 | Dashboard e Transações (CRUD, filtros, gráficos, resumo detalhado) | ✅ Concluído | 2 bugs corrigidos |
| Bloco 3 | Cartões, Faturas e Parcelas | ✅ Concluído | — |
| Bloco 4 | Assistente IA, Importar CSV, Backup, Configurações | ✅ Concluído | 1 bug corrigido em /settings |
| Bloco 5 | Build limpo, PWA instalável, qualidade de código | ✅ Concluído | 12 erros TS corrigidos, ícones PWA criados |

### Bugs corrigidos durante testes

| Commit | Arquivo | Problema | Solução |
|---|---|---|---|
| `a66c92d` | `DonutChart.tsx:82` | `percentual.toFixed is not a function` — backend retorna string | `Number(item.percentual).toFixed(1)` |
| `a66c92d` | `AddTransactionPage.tsx:612` | Saldo estimado exibia `R$ NaN` — concatenação de string | `Number(stats.saldo)` na passagem para `ImpactPreview` |
| `fe3c8c9` | `SettingsPage.tsx:317` | Confirmação de remoção exibida para todas as categorias por padrão | `deletingId !== null &&` antes da comparação com `cat.id` |
| `07d476b` | `CardFormModal`, `EditTransactionModal`, `AddTransactionPage` | `invalid_type_error` e `error` inexistentes em `z.coerce.number()` no Zod v4 | `.refine(v => !isNaN(v))` + `.refine(v => v > 0)` |
| `07d476b` | `CardFormModal`, `EditTransactionModal`, `AddTransactionPage` | `zodResolver` infere tipo INPUT (`unknown`) incompatível com `useForm<OutputType>` | Import `Resolver` + cast `zodResolver(schema) as Resolver<z.infer<typeof schema>>` |
| `07d476b` | `BarChart.tsx`, `DonutChart.tsx` | Formatter do Recharts espera `ValueType/NameType`, não `number/string` | `(value: unknown, name: unknown)` com cast interno |
| `15798da` | `public/` | Ícones PWA `icon-192.png` e `icon-512.png` ausentes | Gerados via Pillow: fundo âmbar #EF9F27, letra B off-white centralizada |
| `f55c4df` | `SettingsPage.tsx` | Error handling genérico ao salvar nome — não exibia mensagem do backend | `extractDetail` extrai `error.response.data.detail` (string/array/objeto) |
| `f55c4df` | `SettingsPage.tsx` | Botão X aparecia para categorias padrão (`usuario_id === null`) | Loop usa `categories.map()` com condição `{cat.usuario_id !== null && <X>}` |
| `f55c4df` | `SettingsPage.tsx`, `services/categories.ts`, `hooks/useCategories.ts` | Emoji em categorias: sem suporte a emoji no nome | Campo aceita emoji; `extractEmojiAndName` via `Intl.Segmenter`; fallback `📦`; sugestões desktop |
| `f55c4df` | `DashboardPage.tsx` | Empty state do Dashboard não diferenciava mobile/desktop | Texto contextual via `useBreakpoint`: 'botão + abaixo' vs 'ícone + na barra lateral' |
| `41522d5` | `Toast.tsx`, `App.tsx`, hooks | Toast de sucesso ausente em toda a aplicação | `ToastContainer` com auto-dismiss 3s, animação suave, posição adaptativa mobile/desktop |

---

## Próximos Passos

### Features de autenticação (etapa atual)

#### 1. Recuperação de senha por e-mail (Resend)
- **Backend:** `POST /auth/forgot-password` (recebe email, gera token, envia link via Resend) + `POST /auth/reset-password` (valida token, atualiza senha)
- **Frontend:** tela `/forgot-password` (campo email + botão enviar) + tela `/reset-password?token=...` (novo campo de senha)
- **Serviço de e-mail:** Resend (resend.com) — integração via SDK `resend` no Python

#### 2. Refresh token
- **Backend:** gerar `refresh_token` (JWT de longa duração, ex: 30 dias) no login; `POST /auth/refresh` valida o cookie e retorna novo `access_token`
- **Frontend:** interceptor Axios detecta 401, chama `/auth/refresh` automaticamente e repete a requisição original

### Deploy (próxima etapa)
- **Backend:** publicar `beefree-api` no Railway ou Render (free tier)
  - Configurar variáveis de ambiente (.env) no painel do serviço
  - Apontar `DATABASE_URL` para o Supabase de produção
  - Verificar health check em `/health`
- **Frontend:** publicar `beefree-web` no Vercel
  - Configurar `VITE_API_URL` apontando para o backend em produção
  - Verificar PWA instalável no celular após deploy

---

## Decisões Fixas (não discutir)

- **Backend:** FastAPI + SQLModel + PostgreSQL (Supabase)
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Estado:** Zustand (UI) + TanStack Query (servidor)
- **Roteamento:** React Router v6
- **Gráficos:** Recharts
- **PWA:** Vite PWA Plugin — instalável, ícones gerados (192×192 e 512×512)
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
- [x] 17. Features secundárias (CSV, backup, categorias, perfil)
- [x] 18. Testes end-to-end Blocos 1–5 + correção de bugs críticos

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
| Zod v4 coerce + RHF | `z.coerce.number()` com `.refine()` requer cast `as Resolver<z.infer<typeof schema>>` no zodResolver. |
| Recharts Tooltip formatter | Parâmetros tipados como `unknown` com cast interno — `ValueType`/`NameType` são uniões que incluem `undefined`. |

---

## Arquivos Criados/Modificados por Tarefa

### Tarefa #18 — Testes e correções de bugs (Blocos 1–5)
- `src/pages/Settings/SettingsPage.tsx` — guarda `deletingId !== null` na confirmação de remoção de categorias
- `src/components/cards/CardFormModal.tsx` — Zod v4: `.refine()` substituindo `invalid_type_error`; cast do zodResolver; import `Resolver`
- `src/components/transaction/EditTransactionModal.tsx` — idem
- `src/pages/AddTransaction/AddTransactionPage.tsx` — idem
- `src/components/charts/BarChart.tsx` — formatter `(value: unknown, name: unknown)` com cast interno
- `src/components/charts/DonutChart.tsx` — idem
- `public/icon-192.png` — ícone PWA 192×192 (fundo âmbar, letra B off-white)
- `public/icon-512.png` — ícone PWA 512×512 (fundo âmbar, letra B off-white)

### Tarefa #17 — Features Secundárias (frontend)
- `src/pages/Import/ImportPage.tsx` — upload CSV com drag-and-drop, parse client-side, preview com validação, importação sequencial
- `src/pages/Settings/SettingsPage.tsx` — /settings com Perfil, Categorias customizadas e Exportar dados
- `src/services/auth.ts` — `updateMe(username)`, `changePassword(senha_atual, nova_senha)`
- `src/services/categories.ts` — `createCategory(nome)`, `deleteCategory(id)`; `usuario_id: number | null`
- `src/services/transactions.ts` — `getAllTransactions()` sem filtro de mês para backup
- `src/hooks/useCategories.ts` — `useCreateCategory`, `useDeleteCategory`
- `src/layouts/MobileLayout.tsx`, `DesktopLayout.tsx` — botão de perfil navega para /settings
- `src/App.tsx` — rotas `/import` e `/settings` adicionadas

### Tarefa #16 — Ver Resumo Detalhado (frontend)
- `src/services/statistics.ts` — `getYearlyStats(ano)`, `getCategoryStats({ mes?, ano })`
- `src/services/installments.ts` — novo
- `src/hooks/useStatistics.ts` — `useYearlyStats`, `useCategoryStats`, `useQuarterlyStats`
- `src/hooks/useInstallments.ts` — novo
- `src/components/charts/BarChart.tsx` — novo
- `src/pages/Transactions/SummaryPage.tsx` — página completa com toggle Mês/Trimestre/Ano

### Tarefa #15 — Assistente IA (frontend)
- `src/services/ai.ts` — `sendMessage(mensagem, mes, ano)` como base; `suggestCategory` reutiliza
- `src/pages/Assistant/AssistantPage.tsx` — chat completo com TypingIndicator, MessageBubble, StatsPanel (desktop)

### Tarefa #14 — Cartões e faturas (frontend)
- `src/services/cards.ts` — tipos e funções de cartões/faturas
- `src/hooks/useCards.ts` — mutations e queries de cartões/faturas
- `src/components/cards/` — CardVisual, CardFormModal, InvoiceMonthGrid, InvoiceDetail
- `src/pages/Cards/CardsPage.tsx` — página completa mobile/desktop

### Tarefa #13 — Adicionar transação com parcelamento (frontend)
- `src/pages/AddTransaction/AddTransactionPage.tsx` — form completo com parcelamento, sugestão IA, ImpactPreview

### Tarefa #12 — Transações (frontend)
- `src/components/transaction/` — TransactionItem, TransactionGroup, EditTransactionModal, DeleteConfirmModal
- `src/pages/Transactions/TransactionsPage.tsx` — filtros, busca, agrupamento por data

### Tarefa #11 — Dashboard (frontend)
- `src/components/charts/DonutChart.tsx` — novo
- `src/pages/Dashboard/DashboardPage.tsx` — métricas, DonutChart, últimas transações, empty state

### Tarefa #10 — Login + Cadastro (frontend)
- `src/components/ui/Button.tsx`, `Input.tsx`, `Spinner.tsx`
- `src/pages/Auth/LoginPage.tsx`, `RegisterPage.tsx`

### Tarefas #1–#9 — Backend completo + Setup Frontend
- Backend FastAPI: auth, transações, categorias, cartões, faturas, parcelas, estatísticas, IA
- Frontend setup: Vite + Tailwind + PWA + layouts + Zustand + TanStack Query

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
│   └── versions/
│       └── abdb546095c0_initial_schema.py
└── app/
    ├── models/       user, card, transaction, category, installment  ✓
    ├── schemas/      auth, transaction, category, card, invoice, installment, statistics, ai  ✓
    ├── routers/      auth, transactions, categories, cards, invoices, installments, statistics, ai  ✓
    └── core/         auth, database, config  ✓
```

---

## Estrutura de Pastas Atual (Frontend)

```
beefree-web/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── public/
│   ├── manifest.json        ✓
│   ├── icon-192.png         ✓  (gerado — fundo âmbar, letra B)
│   └── icon-512.png         ✓  (gerado — fundo âmbar, letra B)
└── src/
    ├── layouts/             DesktopLayout, MobileLayout, AuthLayout  ✓
    ├── pages/               Dashboard, Transactions/Summary, AddTransaction, Cards, Assistant, Auth, Settings, Import  ✓
    ├── components/          ui/, charts/, transaction/, cards/  ✓
    ├── hooks/               useBreakpoint, useTransactions, useCategories, useStatistics, useCards, useAuth, useInstallments  ✓
    ├── store/               authStore, uiStore  ✓
    ├── services/            api, auth, transactions, categories, cards, ai, statistics, installments  ✓
    └── styles/              tokens.css  ✓
```

---

*Última atualização: 31 de Maio de 2026 — Bugs #1–#5 corrigidos e commitados. Próximo: recuperação de senha via Resend + refresh token.*  
*Projeto: BeeFree — gestão financeira pessoal com IA*  
*Repositório FinanceAI original: github.com/lucasdonnangelo/financeai*
