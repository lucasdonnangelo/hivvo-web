# BeeFree — Sessão Atual

## Antes de começar
Leia os arquivos `docs/BeeFree_Referencia.md` e `docs/SESSAO_ATUAL.md` para entender o produto, a arquitetura e as decisões de stack. Não proponha alternativas de tecnologia — as escolhas já foram feitas.

---

## Estado do Projeto

**Fase atual:** Fase 2 — Frontend React PWA (base)  
**Próxima tarefa:** #13 — Adicionar transação com parcelamento (frontend)  
**Última tarefa concluída:** #12 — Transações (frontend)

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
- [ ] 13. Adicionar transação com parcelamento (frontend)
- [ ] 14. Cartões e faturas (frontend)
- [ ] 15. Assistente IA (frontend)
- [ ] 16. Ver resumo detalhado (frontend)
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
    │   │   └── TransactionsPage.tsx ✓
    │   ├── AddTransaction/          — placeholder (Tarefa #13)
    │   ├── Cards/                   — placeholder (Tarefa #14)
    │   ├── Assistant/               — placeholder (Tarefa #15)
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
    │   │   └── DonutChart.tsx       ✓
    │   ├── transaction/
    │   │   ├── TransactionItem.tsx  ✓
    │   │   ├── TransactionGroup.tsx ✓
    │   │   ├── EditTransactionModal.tsx  ✓
    │   │   └── DeleteConfirmModal.tsx    ✓
    │   └── cards/                   — vazio (Tarefa #14+)
    ├── hooks/
    │   ├── useBreakpoint.ts         ✓
    │   ├── useTransactions.ts       ✓
    │   ├── useCategories.ts         ✓
    │   ├── useStatistics.ts         ✓
    │   └── useAuth.ts               ✓
    ├── store/
    │   ├── authStore.ts             ✓
    │   └── uiStore.ts               ✓
    ├── services/
    │   ├── api.ts                   ✓
    │   ├── auth.ts                  ✓
    │   ├── transactions.ts          ✓
    │   ├── categories.ts            ✓
    │   └── cards.ts                 ✓
    └── styles/
        └── tokens.css           ✓
```

---

*Última atualização: 28 de Maio de 2026 — Tarefa #12 concluída, iniciando Tarefa #13 (Adicionar Transação)*  
*Projeto: BeeFree — gestão financeira pessoal com IA*  
*Repositório FinanceAI original: github.com/lucasdonnangelo/financeai*
