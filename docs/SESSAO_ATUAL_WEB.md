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
**✅ Web-Batch 6 / FE-10 concluído (29/06/2026):** unwrap tolerante de contrato. Novo helper `src/lib/unwrapList.ts` (`unwrapList<T>(data): T[]` — aceita array nu OU envelope `{items|data: [...]}`, nunca lança, loga `console.warn` em shape inesperado e devolve `[]`). Aplicado nos 7 retornos de **lista**: `getTransactions`/`getAllTransactions`, `getCards`/`getInvoices`, `getCategories`, `getInstallments`, `getHistorico` (lista simples, qualifica). Endpoints de objeto único não tocados. Zod **não** usado nesta passada (decisão registrada — follow-up). Comportamento idêntico com o contrato de hoje. Paths dos services confirmados **todos relativos** (sem host hardcoded — sem furo para o T-28).
**✅ Web — export do backup apontado para `/transactions/export` (30/06/2026):** fecha a costura do API Batch 8. O backend passou a aplicar `limit` default 100 no `GET /transactions`, o que truncava o backup JSON. `getAllTransactions()` (único consumidor: `SettingsPage.handleExport`, botão "Exportar JSON") agora chama `GET /transactions/export` (sem teto, path relativo), mantendo `unwrapList` no retorno. Nenhum outro caminho afetado — `getTransactions(mes, ano)` e demais services inalterados.
**✅ FE-09 concluído (30/06/2026):** TypeScript `strict` ligado de verdade — `"strict": true` em `tsconfig.app.json` (cobre `src/`) e `tsconfig.node.json` (cobre `vite.config.ts`), sem desligar nenhuma sub-flag. **`npm run build` verde com 0 erros.** Levantamento: o strict acendeu **zero** erros (verificado com `tsbuildinfo` apagado + `--force` + `-p` direto + build completo; sanity-check confirmou que o `--strict` está ativo). Causa do zero: (1) **zero `any` no `src/`** — strict não é satisfeito de forma vazia; (2) os campos genuinamente nulos já vinham tipados como nulos e **guardados com guarda real** dos batches anteriores (`fatura_aberta_total ?? '0'`, `variacao_* != null ?`, `total_parcelas &&`, `cat.id == null`); (3) os campos monetários sempre-presentes (`valor`, `limite`, `total`, `valor_parcela`) são honestamente `string` não-nulo (contrato §5: `Numeric(15,2)` obrigatório). **0 `!` e 0 `as` introduzidos; 0 pontos monetários alterados** (nenhum precisou — `fatura_aberta_total` já estava com `?? '0'`). Decisão registrada: NÃO inventar `| null` onde o backend não permite. Proteção de runtime contra "backend manda lixo → `NaN`" fica como o **follow-up de Zod leniente** (Web-Batch 6), fora do escopo do FE-09.
**✅ Web T-28 concluído (01/07/2026):** base URL apontada para `/api/v1` (fecha a costura cross-repo do hard switch do backend). Única mudança de código: fallback hardcoded em [api.ts:12](../src/services/api.ts#L12) `http://localhost:8000` → `http://localhost:8000/api/v1`. Como o `/api/v1` entra pela `baseURL` do axios (`axios.create({ baseURL })`), `base + '/transactions'` = `.../api/v1/transactions` — **nenhum path de service tocado** (todos relativos, confirmado no Web-Batch 6). Verificado por leitura: zero services com host ou `/api/v1` embutido (grep), zero chamadas a `/health` no frontend (nada precisa ir à raiz). `.env.example` atualizado para `http://localhost:8000/api/v1` + comentário documentando dev (`http://localhost:8000/api/v1`) e produção (`https://api.hivvo.app/api/v1`). `npm run build` verde. Não tocados: cookies/topologia (Batch 11), `vercel.json`/`connect-src`, lógica de negócio.
**✅ Web-Batch 7 / FE-11 concluído (30/06/2026):** code-splitting por rota. As 14 páginas viraram `React.lazy(() => import())` em `App.tsx`; o shell (`AuthLayout`/`MobileLayout`/`DesktopLayout` + `ToastContainer` + init) continua **eager**. `<Suspense>` colocado **dentro** de cada layout, ao redor do `<Outlet/>` (fallback `RouteFallback` — spinner centralizado no tema escuro, nunca `null`), então header/tab bar/sidebar não piscam na troca de rota; rotas legais (sem shell) têm `<Suspense>` próprio. Resultado: chunk inicial **1.014,27 kB → 294,63 kB** (gzip 297,60 → 95,72; −68%); **recharts isolado** (chunk de ~317 kB carregado só em Dashboard/Summary) e **react-markdown isolado** (no chunk do Assistant ~126 kB) — quem abre o login não baixa mais nenhum dos dois. PWA: precache subiu de 7 → **35 entradas** (workbox `globPatterns` default inclui todos os `*.js`), então **todos os chunks por rota são precacheados** — offline não quebra por chunk ausente. `manualChunks` não usado (opcional; o split por rota já separa as libs pesadas). Sem mudança de comportamento, lógica ou tipos.
**✅ Web — SPA fallback no `vercel.json` (02/07/2026):** corrige o 404 do Vercel em acesso direto a rotas (ex.: abrir `https://app.hivvo.app/reset-password?token=...` em aba nova/cold, ou recarregar qualquer rota salva). Causa: o `vercel.json` só tinha `headers`, sem `rewrites` — sem o fallback de SPA o Vercel tentava servir um arquivo físico inexistente e devolvia 404. Fix: adicionado `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` para o React Router resolver client-side. **Todos os `headers` preservados integralmente** (CSP, HSTS, Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy + header de `/sw.js`) — nenhum header alterado. **Confirmação do comportamento do Vercel:** a ordem de roteamento é `redirects` → verificação do filesystem → `rewrites` → 404; rewrites só se aplicam a caminhos que **não** correspondem a um arquivo estático existente, então `/assets/*`, `/sw.js`, `/manifest.webmanifest`, favicon e os chunks JS (precacheados) são servidos direto do filesystem — o rewrite **não** os captura, e o header de `/sw.js` continua aplicado no estágio de `headers`. Não foi preciso excluir `/sw.js`/`/assets` do padrão (o default do Vercel já os preserva). JSON validado; `npm run build` verde (config de deploy não afeta o build). Nenhum header/CSP, código ou outro item tocado.
**✅ Web-Batch A concluído (02/07/2026):** dois ajustes de UI. **(#3) Logo → home:** o wordmark "Hivvo" do header mobile ([MobileLayout.tsx](../src/layouts/MobileLayout.tsx)) e o "H" da sidebar desktop ([DesktopLayout.tsx](../src/layouts/DesktopLayout.tsx)) agora são `<Link to="/dashboard">` do React Router (navegação client-side, **sem `<a href>`/full reload**), com `cursor-pointer`, foco de teclado (Link é focável) + `focus-visible:ring-2 ring-amber` (token, sem hex) e `aria-label="Ir para o início"`. Não há componente de logo compartilhado — aplicado inline nos dois layouts. **(#4) Ícone de Transações (mobile):** troca de glifo — `↕` (U+2195, que o iOS/alguns SO promovem a *emoji colorido* → o "azul destoante") por **`⇄` (U+21C4)**, setas horizontais **fora do conjunto emoji do Unicode** (sempre renderiza como texto monocromático, coerente com os vizinhos `⊞ ▭ ✦`). **Decisão (via pergunta ao usuário):** NÃO instalar lucide-react — a premissa do #4 ("vizinhos já são lucide") estava **incorreta**; todos os ícones de nav dos dois layouts são glifos unicode de texto, não lucide. Trocar só o glifo resolve o destoante sem nova dependência e sem introduzir o único ícone lucide da barra. Cor herdada do `<span>` pai (`text-amber`/`text-text-muted` conforme ativo) — sem hex hardcoded. **Só o item Transações mobile tocado** (demais itens intactos). **Estado do desktop (reporte item c):** o desktop **também** usa o emoji `↕` para Transações (mesma origem) — **NÃO tocado** por estar fora do escopo (#4 = só mobile). `npm run build` verde.
**✅ Web — navegação de meses futuros corrigida (02/07/2026):** bug funcional no seletor de mês. A seta de "próximo mês" ficava **desabilitada** quando o mês selecionado era o atual, impedindo navegar para o futuro. Era uma trava de UI **sem motivo técnico** — os endpoints já aceitam `mes`/`ano` futuros (`getMonthlyStats`, `getTransactions`) e o widget "Compromissos futuros" do Dashboard já consome dados de meses à frente. Num app de parcelamento, ver o futuro é essencial. **Fix (nos DOIS arquivos, hoje com lógica duplicada):** [DashboardPage.tsx](../src/pages/Dashboard/DashboardPage.tsx) e [TransactionsPage.tsx](../src/pages/Transactions/TransactionsPage.tsx) — removido `disabled={isCurrentMonth}` da seta de próximo mês (agora sempre ativa, **simétrica** com a de mês anterior, que já era ilimitada) e o early-return `if (isCurrentMonth) return` do handler `nextMonth`. `isCurrentMonth` era usado **exclusivamente** nessas duas travas em cada arquivo (sem destaque visual nem outro uso) → virou código morto e foi **removido** (o `noUnusedLocals` do strut/FE-09 quebraria o build se ficasse). Removidas também as classes `disabled:*` (agora inertes) do botão de próximo, alinhando com o de anterior — **sem cor hardcoded, sem media query nova**. Navegação de mês anterior **intacta** (ilimitada). Futuro **ilimitado** — NÃO foi adicionado novo cap de horizonte. `npm run build` verde. **Dívida técnica registrada (follow-up, NÃO feito agora):** o seletor de mês está **DUPLICADO** em `DashboardPage` e `TransactionsPage` (estado + handlers + JSX idênticos) — extrair um componente `MonthNavigator` compartilhado é melhoria futura. **A própria duplicação foi a causa deste bug** (a trava existia em dois lugares).
**✅ Web — trava de mês futuro no Resumo Detalhado corrigida + varredura completa (02/07/2026):** mesmo bug do fix anterior, num **terceiro** lugar. A [SummaryPage.tsx](../src/pages/Transactions/SummaryPage.tsx) ("Ver Resumo" / "Resumo Detalhado") tinha a mesma trava, com uma variante de nome (`isCurrentPeriod` em vez de `isCurrentMonth`) que cobria **os TRÊS modos** (Mês/Trimestre/Ano) numa única flag. **Fix:** removido `disabled={isCurrentPeriod}` do botão "Próximo período", o early-return `if (isCurrentPeriod) return` de `goNext` e o `useMemo` `isCurrentPeriod` (virou código morto → `noUnusedLocals`). Como a flag era única para os 3 modos, remover liberou navegação futura em **Mês, Trimestre E Ano** de uma vez, simétrica com `goPrev` (que já era ilimitado nos três). `now` mantido (state inicial); `getQuarter`/`getQuarterStart` mantidos (usados em `barData`/`highlightMeses`/`prevQ`/`quarterStart`). Removidas as classes `disabled:*` agora inertes. Sem cor hardcoded, sem media query nova. **Varredura completa do `src/` (reporte b):** a lógica de trava de mês futuro existia em **exatamente 3 arquivos** (duplicação **TRIPLA**): `DashboardPage` + `TransactionsPage` (já corrigidos, commit `a734fca`) + `SummaryPage` (este fix). **Não são trava** (verificados e intocados): [InvoiceMonthGrid.tsx](../src/components/cards/InvoiceMonthGrid.tsx) — meses futuros recebem `opacity-50` só visual, mas o botão continua **clicável** (`onClick={onSelect}`, sem `disabled`); `CardsPage`/`AssistantPage`/`AddTransactionPage` — `now`/`getMonth()` só para data-default ou stats do mês corrente, `disabled={!canSubmit}` é validação de formulário. `npm run build` verde. **Dívida técnica (follow-up, NÃO feito agora):** a navegação de mês está **triplicada** (Dashboard, Transações, Summary) — extrair um `MonthNavigator` compartilhado é melhoria futura. A duplicação foi a causa de o bug reaparecer em três lugares (e ter sido corrigido em três passadas).
**✅ Web — texto órfão "Gerenciar Parcelas" corrigido (02/07/2026):** no [EditTransactionModal.tsx](../src/components/transaction/EditTransactionModal.tsx), ao editar uma transação **parcelada**, o aviso dizia "Para editar as parcelas, acesse **Gerenciar Parcelas**" — mas "Gerenciar Parcelas" era um `<span className="text-text-primary">` **sem ação** (aparência de link, zero handler), e a feature **não existe** (varredura confirmou: sem rota no router, sem tela, e o service de installments é **só leitura** — só `getInstallments`, nenhuma mutation). Placeholder órfão prometendo algo inexistente. **Fix (só texto):** substituído o parágrafo por redação honesta — *"Transações parceladas não podem ser editadas diretamente — as parcelas já foram distribuídas ao longo dos meses. Para alterá-la, exclua esta transação e registre novamente."* — **sem `<span>` disfarçado de link** (texto normal, `text-text-muted`, token). **Comportamento inalterado:** o modal segue **read-only** para parceladas (early-return da linha 65, "ajuste aprovado" — sem campos editáveis nem botão salvar); só o texto mudou. Grep confirma **zero** ocorrências de "Gerenciar Parcelas" no `src/`. `npm run build` verde. **Projeto futuro registrado:** edição/gerenciamento de **parcelas individuais** (editar/cancelar parcela) — requer UI **+ endpoints de escrita no backend** (hoje `installments` é só leitura). Feature futura (cross-repo).
**✅ Web Fase 3a-frontend-i concluída (03/07/2026):** camada de dados de recorrência + CRIAR recorrência no fluxo de Adicionar. Consome os 5 endpoints reais do backend 2c (`/api/v1/recorrencias`; contrato lido direto do repo `hivvo-api`: routers/schemas). **PARTE 1 — dados:** novo [services/recorrencias.ts](../src/services/recorrencias.ts) (espelha `categories.ts`): interfaces `Recorrencia`/`RecorrenciaDetail`/`RecorrenciaVigencia`/`RecorrenciaCreate`/`RecorrenciaUpdate` com **`valor` sempre string** (Decimal; `id` é UUID string) + 5 funções (`getRecorrencias` com `unwrapList`, `getRecorrencia`, `createRecorrencia` POST, `updateRecorrencia` PATCH, `deleteRecorrencia`). Novo [hooks/useRecorrencias.ts](../src/hooks/useRecorrencias.ts) (espelha `useCategories.ts`): `useRecorrencias` (query `['recorrencias', incluirEncerradas]`, staleTime 5min) + `useCreate/Update/DeleteRecorrencia`. Cada mutation invalida a **projeção**: `['recorrencias']`, `['statistics','monthly']`, **`['statistics','yearly']`** + o conjunto do padrão `useTransactions` (`['transactions']`, `['cards']`, `['invoices']`, `['invoice-detail']`, `['installments']`) — para Dashboard/Resumo re-buscarem na hora; toast via `useUIStore`. **PARTE 2 — criar no Add** ([AddTransactionPage.tsx](../src/pages/AddTransaction/AddTransactionPage.tsx)): toggle **"Recorrente"** (mesmo switch visual do `parcelado`, logo abaixo do Tipo, com apoio "Um lançamento que se repete todo mês"). **Mutuamente exclusivo** com parcelamento/cartão (ligar recorrente zera `parcelado`/`cartao_id`/`total_parcelas` e derruba "Crédito" da forma → PIX; o bloco de parcelamento nem renderiza em modo recorrente). Modo recorrente **mantém** tipo/valor/descrição/categoria/forma, **remove** data única/parcelamento/cartão, **adiciona** "Dia do mês" (1–31) e "Começa em" (`<input type="month">` → `mes_inicio`/`ano_inicio`) **pré-preenchido pela regra do dia** (dia ≥ hoje → mês corrente; senão seguinte, com virada de ano) e **editável** (flag `inicioManual` + effect que recomputa enquanto não editado à mão). Forma exclui "Crédito" no modo recorrente (§3.4 — recorrência não passa por cartão; decisão aprovada). Submit **roteia para POST `/recorrencias`** quando recorrente; valor via `parseFloat(...).toFixed(2)` (**string**); **sempre envia** `mes_inicio`/`ano_inicio` do campo (faz o "ajustar" valer). `ImpactPreview` (desktop) oculta "×N parcela"/"saldo após" e mostra "Todo dia X · começa MM/AAAA". **Decisão aprovada (contrato × spec):** campo "fim/término" **NÃO** incluído no criar — o `RecorrenciaCreate` do backend não aceita `mes_fim`/`ano_fim` (1ª vigência sempre aberta); definir término é DELETE/edição, do **3a-frontend-ii**. `npm run build` verde. **Não feito (é o 3a-frontend-ii):** seção Gerenciar recorrências no Settings (listar/editar/excluir).
**✅ Web — Dashboard realizado/a-vir/projeção no mês corrente (04/07/2026, §1.3.1):** o Dashboard passa a contar as três leituras do mês corrente. **Service** ([statistics.ts](../src/services/statistics.ts)): interface `LeituraMes { receitas, despesas, saldo }` + campos aditivos `realizado`/`a_vir` em `MonthlyStats`, parseados com `Number()` em `parseMonthly` (Decimals → string, igual aos demais). O topo (projeção integral: `receitas/despesas/saldo/variação/categorias`) **não mudou** — nenhum campo existente alterado; hooks de agregação (quarterly/annual) ignoram os novos campos. **Dashboard** ([DashboardPage.tsx](../src/pages/Dashboard/DashboardPage.tsx)): os 3 cards continuam mostrando a **projeção**. Card de Saldo: rótulo vira **"Projeção de [mês]"** no mês corrente (senão "Saldo do Mês"); ganha **decomposição** abaixo do valor — "Já realizado: R$X" (`realizado.saldo`) e "A vir este mês: R$Y" (`a_vir.saldo`), como parte nativa do card (`MetricCard` ganhou prop opcional `decomposition`; mesmo componente cobre mobile+desktop). **Colapso natural:** decomposição só quando `a_vir.receitas > 0 || a_vir.despesas > 0` (gate por magnitude, não por saldo — que pode ser 0 com movimentos a vir que se anulam) → some em mês não-corrente (backend zera `a_vir`) e no fim do mês corrente. Sem tooltip (rótulos são a explicação); tokens Tailwind. Variação continua usando a projeção (não o realizado parcial). `npm run build` verde. Não tocados: Transações, Resumo, outros cards.
**✅ Web — empty state honesto em Transações (04/07/2026):** a lista de Transações mostra só as transações REGISTRADAS do mês (`getTransactions`); um mês futuro/sem avulsas exibia "Sem transações / Nenhuma movimentação em [mês]" — enganoso, pois o Dashboard/Resumo do mesmo mês mostram as PARCELAS que vencem ali (não são transações registradas naquele mês). Em [TransactionsPage.tsx](../src/pages/Transactions/TransactionsPage.tsx), só o ramo `transactions.length === 0` do empty state mudou de texto (mesmo componente/estilo, sem redesenhar): título "Nenhuma transação registrada em [mês] [ano]" + descrição "Você não registrou transações avulsas neste mês. Parcelas de compras anteriores que vencem aqui aparecem no Dashboard e no Resumo." O ramo de filtro/busca sem resultado ("Nenhum resultado / Tente ajustar os filtros") **não** mudou. Opcional aplicado (trivial, mesmo arquivo, sem tocar em cálculo): o resumo do topo agora rotula a contagem como "N transações registradas" (pluralização mantida) — deixa claro que conta o registrado, não o fluxo total; o valor/cálculo (`totalFiltrado`) intocado. Sem tooltip; tokens. `npm run build` verde. Não tocados: Dashboard, Resumo, cálculo, o ramo de filtros.
**✅ Web Fase 3a-frontend-ii concluída (04/07/2026):** gerenciar recorrências no Settings. Nova `<Section title="Recorrências">` em [SettingsPage.tsx](../src/pages/Settings/SettingsPage.tsx), logo após Categorias, imitando o padrão (lista inline + `<Modal>` useState + ✕ com confirmação inline — SEM RHF, SEM redesenho). **Listar** (`useRecorrencias`, só ativas): cada item mostra "descrição · {valor vigente}/mês" com o valor colorido por tipo (`text-success`/`text-danger`) + sublinha "Receita|Despesa · todo dia N"; `valor_vigente` null → "—". Loading (skeleton) + empty ("Nenhuma recorrência cadastrada. Crie uma ao adicionar um lançamento recorrente."). Área esquerda do item é botão → abre editar; ✕ → encerrar. **Editar** (modal useState): descrição, valor, categoria (`<select>` das categorias do tipo da rec + valor atual garantido), dia_do_mes, forma_pagamento (`<select>` FORMAS_RECORRENCIA sem Crédito). PATCH via `updateRecorrencia`; **envia `valor` só quando muda** (evita versão espúria — backend versiona ao receber `valor` com vigência aberta em mês passado); metadados retroativos sempre. **Nota de versionamento contextual** aparece só ao alterar um valor vigente existente ("A alteração de valor vale a partir deste mês. Os meses anteriores mantêm o valor anterior."); metadados não disparam. **Encerrar** (✕ + confirmação inline com nota "A recorrência para de gerar a partir deste mês. O histórico dos meses anteriores é mantido.") via `deleteRecorrencia` → some da lista. Mutations já invalidam a projeção (3a-frontend-i) → Dashboard/Resumo refletem na hora. **CONTRATO (reporte e):** o `RecorrenciaUpdate` (PATCH) **NÃO aceita `mes_fim`/`ano_fim`** (confirmado no schema + router — encerrar só via DELETE, no mês corrente) → o campo "Encerrar em [mês/ano]" **não foi implementado** (decisão aprovada; "encerrar em data futura" seria mudança de backend, outro batch). Valor Decimal/string (`.toFixed(2)`), tokens, sem tooltip, responsivo (Section serve mobile+desktop). `npm run build` verde. Não tocados: Dashboard, Add, cálculo.
**✅ Web — operações de erro na recorrência (§3.1.2) (04/07/2026):** UI das duas operações de ERRO (distintas das normais encerrar/alterar), com avisos que educam. **PARTE 1 — dados:** [services/recorrencias.ts](../src/services/recorrencias.ts) ganhou `deleteRecorrenciaPermanente(id)` (DELETE `/{id}/permanente`, hard delete) e `corrigirValorRecorrencia(id, valor)` (PATCH `/{id}/corrigir-valor`, body `{valor}`); [hooks/useRecorrencias.ts](../src/hooks/useRecorrencias.ts): `useDeleteRecorrenciaPermanente`/`useCorrigirValorRecorrencia` (invalidam a projeção + toast) e `useRecorrenciaDetail(id)` (query `['recorrencias','detail',id]`, p/ o modal saber `vigencias.length`). O 409 do corrigir é tratado no componente (toast com a mensagem do backend, modal aberto). **PARTE 2 — ✕ encerrar:** só o texto da confirmação inline mudou, agora distingue encerrar de apagar e direciona ("...Se esta recorrência foi criada por engano e você quer removê-la completamente (inclusive do passado), use Editar → Apagar permanentemente."); o encerrar segue soft (`deleteRecorrencia`). **PARTE 3 — modal de editar** ([SettingsPage.tsx](../src/pages/Settings/SettingsPage.tsx)): ao mudar o valor, duas intenções nomeadas por radio — "Alterar valor" (versionado, default) vs "Corrigir valor" (retroativo, todos os meses); **"Corrigir valor" só aparece com `vigencias.length === 1`** (erro fresco). No Salvar com "corrigir": **corrigir-valor PRIMEIRO** (é o passo que pode 409 — se falhar, nada é escrito, sem estado parcial nem toast de sucesso competindo), depois metadados alterados via PATCH normal (caso comum = só o valor → 1 chamada). Falha do corrigir → toast **explícito** "O valor não foi corrigido." + detalhe do backend, modal aberto. Cancelar da confirmação de apagar volta ao editar preservando os campos (só X/backdrop/Esc fecham tudo). **Apagar permanentemente** no rodapé do modal, cor de perigo (`text-danger`), subordinado (Cancelar/Salvar à direita); ao clicar, o modal troca para confirmação ("Apagar permanentemente?") com aviso honesto do que se perde + `<Button variant="danger">` (confirmação normal, sem digitar nome) → `deleteRecorrenciaPermanente` → fecha, some da lista, projeção reflete. Tokens (sem hex), sem drama, valor Decimal/string, responsivo. `npm run build` verde. Não tocados: Dashboard, Add, cálculo.
**Próximo passo imediato:** próximos itens pré-deploy do `PLANO_EXECUCAO_WEB.md` conforme priorização (recorrência: criar + gerenciar + operações de erro completos; falta, se desejado, distinguir itens recorrentes/projetados nas listas — Fase 3 telas). (Follow-ups opcionais fora de escopo: extrair `MonthNavigator` compartilhado — navegação de mês triplicada em Dashboard/Transações/Summary; o desktop ainda usa `↕` para Transações — se desejado trocar por `⇄` também; **projeto futuro:** edição/cancelamento de parcelas individuais — precisa de UI + endpoints de escrita no backend.)

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

## Web-Batch 6 — Concluído ✅ (29/06/2026)

FE-10 — **unwrap tolerante de contrato.** Mudança ADITIVA preparando o frontend para o envelope de paginação do backend (API Batch 8 / `/api/v1`) **sem big-bang**: os services de lista aceitam tanto o contrato atual (array nu) quanto o futuro envelope, e o app continua se comportando IDÊNTICO hoje.

| Item | O que foi feito |
|---|---|
| Helper central | `src/lib/unwrapList.ts` — `unwrapList<T>(data: unknown): T[]`. Regras: array nu → retorna o próprio array (mesma referência); `{ items: [...] }` → array interno; `{ data: [...] }` → array interno (variante de envelope); qualquer outra coisa → `console.warn` com o shape + retorna `[]`. **Nunca lança** (tolerância é o ponto — lição T-37: não barrar dado válido). |
| Services de lista | Aplicado em **7 retornos**: `getTransactions` + `getAllTransactions` ([transactions.ts](../src/services/transactions.ts)); `getCards` + `getInvoices` ([cards.ts](../src/services/cards.ts)); `getCategories` ([categories.ts](../src/services/categories.ts)); `getInstallments` ([installments.ts](../src/services/installments.ts)); `getHistorico` ([ai.ts](../src/services/ai.ts)). Padrão: `.then((r) => unwrapList<T>(r.data))`. Os genéricos preservam os tipos (`Transaction[]` etc.) — nenhum consumidor (hooks/páginas) mudou. |
| `getHistorico` (ai.ts) | **Incluído.** Verificado que `GET /ai/historico` retorna uma **lista simples** (array flat de `HistoricoItem` = `{ role, text, created_at?, sessao_id? }`), sem shape/envelope próprio — qualifica para o mesmo unwrap tolerante. (Não é o caminho de sugestão de categoria, que é objeto único e fora do escopo.) |
| NÃO tocados (objeto único) | `getInvoiceDetail`, `createTransaction`/`updateTransaction`, `createCard`/`updateCard`/`deactivateCard`, `createCategory`, e os `delete*`. |
| Zod | **Não usado nesta passada** (decisão deliberada, permitida pelo batch). Validar lista com Zod agora adicionaria risco de barrar dado válido (T-37) sem ganho, e `strict`/FE-09 é batch separado. **Follow-up:** se desejado, adicionar schemas Zod LENIENTES (`.optional()`/`.nullable()` em campos omitíveis, log em vez de throw) ao redor do `unwrapList` quando o envelope real existir. |
| Paths relativos (reporte) | Verificado: **todos os paths dos services são relativos** (`/transactions`, `/cards`, `/categories`, `/installments`, `/cards/{id}/invoices`…). A única ocorrência de host é o fallback `http://localhost:8000` da base URL em [api.ts](../src/services/api.ts) (correto). **Sem furo para o T-28** — a migração para `/api/v1` entra só via `VITE_API_URL`. |

**Verificação:** `npm run build` verde. Idempotência com o contrato atual garantida por tipo/referência (`unwrapList([...])` devolve o mesmo array). **Não tocados:** FE-09 (strict TS), paginação real (não existe no backend ainda), demais batches.

---

## FE-09 — Concluído ✅ (30/06/2026)

TypeScript `strict` habilitado. Mostrar o tsconfig (deliverable): `"strict": true` em **`tsconfig.app.json`** (cobre `src/`) e **`tsconfig.node.json`** (cobre `vite.config.ts`). Nenhuma sub-flag desligada. As flags de lint já presentes (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) foram mantidas.

### Contagem de erros que o strict acendeu: **0** (por arquivo e por tipo)

| Sub-flag | Erros |
|---|---|
| `strictNullChecks` (possibly null/undefined) | 0 |
| `noImplicitAny` | 0 |
| `strictFunctionTypes` / `strictBindCallApply` / `strictPropertyInitialization` | 0 |
| `noImplicitThis` / `useUnknownInCatchVariables` / `alwaysStrict` | 0 |
| **Total** | **0** |

### Por que zero (verificado, não é cache nem falso negativo)
1. **`--strict` comprovadamente ativo:** num arquivo isolado, `function f(x?: string){ return x.toUpperCase() }` acende `TS18048`. Type-check rodado com `tsbuildinfo` apagado, `--force`, `-p tsconfig.app.json` direto e `npm run build` completo — todos exit 0.
2. **Zero `any` no `src/`** (`: any` / `as any` / `<any>` → nenhuma ocorrência) — strict não é satisfeito de forma vazia.
3. **Campos legitimamente nulos já tipados como nulos e guardados** (sem `!`, sem `as`): `fatura_aberta_total: string \| null` → `parseFloat(... ?? '0')` ([CardVisual.tsx:22](../src/components/cards/CardVisual.tsx#L22)); `variacao_*: number \| null` → `!= null ? Number() : null` ([statistics.ts:51-53](../src/services/statistics.ts#L51)); `total_parcelas: number \| null` → `tx.parcelado && tx.total_parcelas` ([TransactionItem.tsx:22](../src/components/transaction/TransactionItem.tsx#L22)); `cat.id: number \| null` → `if (cat.id == null) return` ([SettingsPage.tsx:386](../src/pages/Settings/SettingsPage.tsx#L386)).
4. **Campos monetários sempre-presentes tipados honestamente como não-nulo** (`valor`, `limite`, `total`, `valor_parcela`) — coerente com o contrato (Referência §5: `Numeric(15,2)` obrigatório). Inventei `| null` em nenhum.

### Relatório de verificação
- Erros corrigidos: **0** (não havia).
- `!` ou `as` introduzidos: **0**.
- Pontos monetários tocados: **0** (todos os nulos já tinham guarda real; `fatura_aberta_total` já com `?? '0'`).

### Decisão / follow-up
- **Decisão fixa:** não tornar `| null` campos que o backend sempre envia (não inventar nulabilidade).
- **Follow-up (separado, fora do FE-09):** o strict, sozinho, não protege contra "backend omite campo monetário → `NaN`" porque o tipo declara presença. A proteção de runtime viria de **schemas Zod lenientes** ao redor do `unwrapList` — já registrado como follow-up do Web-Batch 6. Não feito aqui (escopo).

**Não tocados:** FE-11 (code splitting), Zod runtime, lógica de negócio, demais batches.

---

## Web-Batch 7 — Concluído ✅ (30/06/2026)

FE-11 — **code-splitting por rota.** Mudança SEM alteração de comportamento: só muda *como* o bundle carrega. Antes: um único `index` de 1.014 kB carregado no boot (recharts + react-markdown inclusos, mesmo para quem só abre o login).

| Item | O que foi feito |
|---|---|
| `App.tsx` — lazy | As 14 páginas (`Login`/`Register`/`Forgot`/`Reset`, `Dashboard`, `Transactions`, `Summary`, `Add`, `Cards`, `Assistant`, `Import`, `Settings`, `Terms`, `Privacy`) passaram a `lazy(() => import())`. Shell mantido **eager**: `AuthLayout`, `MobileLayout`, `DesktopLayout`, `ToastContainer`, `useBreakpoint`, stores/services de init. |
| Suspense dentro do shell | `<Suspense fallback={<RouteFallback/>}>` ao redor **só do `<Outlet/>`** em `MobileLayout`/`DesktopLayout` (dentro do `<main>`) e em `AuthLayout` (dentro do card). Header + tab bar (mobile) / sidebar (desktop) permanecem montados — a navegação não pisca. Rotas legais `/terms` e `/privacy` (sem layout) têm `<Suspense>` próprio. |
| `RouteFallback` (novo) | `src/components/ui/RouteFallback.tsx` — spinner centralizado (reusa o `Spinner`), `text-text-muted`, `h-full min-h-[40vh]`. **Nunca `null`/tela branca**; respeita o tema escuro e renderiza dentro da área de conteúdo. Reusado nos 3 layouts + rotas legais. |
| `manualChunks` | **Não usado** (opcional por escopo). O split por rota já isola recharts e react-markdown; não complicar a config. |
| `vite.config.ts` | **Não tocado.** O `generateSW` (workbox, `autoUpdate`) usa `globPatterns` default que inclui `**/*.js` → todos os novos chunks entram no precache. |

### Tamanhos — antes vs. depois (build com `VITE_API_URL` para comparação justa)
| | Antes | Depois |
|---|---|---|
| Chunk inicial (`index`) | **1.014,27 kB** / gzip **297,60 kB** | **294,63 kB** / gzip **95,72 kB** (−68% gzip) |
| recharts | no chunk inicial | isolado (`DonutChart` ~317 kB) — só Dashboard/Summary |
| react-markdown | no chunk inicial | no chunk do Assistant (~126 kB) — só Assistant |
| libs de form (RHF/zod) | no chunk inicial | chunk compartilhado (`Input` ~98 kB) — só rotas com formulário |

**Carregamento do login (cold boot):** antes baixava os 1.014 kB inteiros; agora baixa só `index` + `LoginPage` (2,4 kB) + chunk de form — **sem recharts e sem react-markdown**. Cada rota baixa seu chunk sob demanda na primeira visita.

### PWA / offline
Precache subiu de **7 → 35 entradas** (943,59 KiB no build padrão; 1028,11 KiB com o código da API). **Todos os chunks por rota são precacheados** pelo workbox → navegação offline para qualquer rota não quebra por chunk não cacheado. `autoUpdate` mantido.

**Verificação:** `npm run build` verde com e sem `VITE_API_URL`. Fallback de Suspense dentro do shell em todas as rotas (nenhum `null`). **Não tocados:** lógica de negócio, FE-09, tipos, demais batches.

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

*Última atualização: 4 de julho de 2026 — Web: operações de erro na recorrência (§3.1.2). Service/hooks ganharam `deleteRecorrenciaPermanente` (DELETE /{id}/permanente), `corrigirValorRecorrencia` (PATCH /{id}/corrigir-valor) e `useRecorrenciaDetail` (p/ contar vigências). ✕ encerrar reforçado no texto (direciona a Editar → Apagar). Modal de editar: ao mudar valor, radios "Alterar valor" (versionado) vs "Corrigir valor" (retroativo, só com 1 vigência; 409 → toast); rodapé com "Apagar permanentemente" (cor de perigo, subordinado) → confirmação normal com aviso honesto → hard delete. Tokens, sem drama, Decimal/string. `npm run build` verde.*
*Anterior: 4 de julho de 2026 — Web Fase 3a-frontend-ii: gerenciar recorrências no Settings. Nova Section "Recorrências" (após Categorias, mesmo padrão: lista inline + modal useState + ✕ com confirmação). Listar (só ativas) com valor vigente/mês colorido por tipo + "todo dia N"; editar (descrição/valor/categoria/dia/forma) via PATCH com nota de versionamento contextual só ao mudar o valor (valor enviado só quando muda); encerrar via DELETE com nota de preservação do passado. CONTRATO: PATCH não aceita mes_fim/ano_fim → campo de término NÃO implementado (encerrar só via ✕/DELETE no mês corrente). Tokens, sem tooltip, valor Decimal/string. `npm run build` verde.*
*Anterior: 4 de julho de 2026 — Web: empty state honesto em Transações. Só o ramo `transactions.length === 0` mudou de texto (título "Nenhuma transação registrada em [mês] [ano]" + descrição direcionando as parcelas ao Dashboard/Resumo); ramo de filtros intacto; contagem do topo rotulada "transações registradas" (cálculo intocado). Sem redesenho, sem tooltip. `npm run build` verde.*
*Anterior: 4 de julho de 2026 — Web: Dashboard exibe realizado/a-vir/projeção no mês corrente (§1.3.1). Service statistics.ts ganhou `LeituraMes` + campos aditivos `realizado`/`a_vir` (parseados com Number; topo/projeção intocado). DashboardPage: card de Saldo vira "Projeção de [mês]" no mês corrente e mostra decomposição "Já realizado"/"A vir este mês" (saldo) abaixo do valor via nova prop `decomposition` do MetricCard (mobile+desktop); colapsa quando `a_vir.receitas>0 || a_vir.despesas>0` é falso (mês não-corrente ou fim do mês). Sem tooltip; tokens; variação segue usando a projeção. `npm run build` verde.*
*Anterior: 3 de julho de 2026 — Web Fase 3a-frontend-i: camada de dados de recorrência (`services/recorrencias.ts` + `hooks/useRecorrencias.ts`, espelhando o par categories; valor sempre string/Decimal, id UUID; mutations invalidam projeção mensal+anual e o conjunto de useTransactions) + CRIAR recorrência no Add (toggle "Recorrente" no padrão do switch parcelado, mutuamente exclusivo; troca campos: some data/parcela/cartão, aparece "Dia do mês" + "Começa em" pré-preenchido pela regra do dia e editável; submit roteia para POST /recorrencias com valor toFixed(2); forma exclui Crédito no modo recorrente). Contrato lido do repo hivvo-api (5 endpoints reais). Campo "fim" NÃO incluído no criar (backend não aceita mes_fim/ano_fim na criação — término é edição/DELETE, do 3a-frontend-ii). `npm run build` verde. Próximo: 3a-frontend-ii (Gerenciar recorrências no Settings).*
*Anterior: 2 de julho de 2026 — Web: texto órfão "Gerenciar Parcelas" corrigido no [EditTransactionModal.tsx](../src/components/transaction/EditTransactionModal.tsx). Era um `<span>` com aparência de link, sem ação, apontando para uma feature inexistente (sem rota, installments só leitura). Substituído por texto honesto (exclua e registre novamente), sem span disfarçado de link, cor via token. Comportamento inalterado (modal segue read-only para parceladas). `npm run build` verde. Projeto futuro registrado: edição/cancelamento de parcelas individuais (precisa de UI + endpoints de escrita no backend).*
*Anterior: 2 de julho de 2026 — Web: trava de mês futuro no Resumo Detalhado ([SummaryPage.tsx](../src/pages/Transactions/SummaryPage.tsx)) corrigida — mesmo bug num terceiro lugar. Removidos `disabled={isCurrentPeriod}`, o early-return de `goNext` e o `useMemo` `isCurrentPeriod` (código morto). A flag única cobria os 3 modos → liberou navegação futura em Mês/Trimestre/Ano de uma vez, simétrica com o passado. Varredura completa do `src/`: trava existia em EXATAMENTE 3 arquivos (duplicação tripla — Dashboard/Transações/Summary, agora todos corrigidos); InvoiceMonthGrid não é trava (mês futuro clicável, só `opacity-50` visual). Sem cor hardcoded/media query. Dívida técnica: navegação de mês triplicada → extrair `MonthNavigator` (follow-up). `npm run build` verde.*
*Anterior: 2 de julho de 2026 — Web: navegação de meses futuros corrigida. Removida a trava de UI (`disabled={isCurrentMonth}` + early-return `if (isCurrentMonth) return`) que impedia avançar além do mês atual, nos DOIS arquivos duplicados ([DashboardPage.tsx](../src/pages/Dashboard/DashboardPage.tsx) e [TransactionsPage.tsx](../src/pages/Transactions/TransactionsPage.tsx)); `isCurrentMonth` virou código morto e foi removido. Seta de próximo mês agora sempre ativa (simétrica com a de anterior, já ilimitada); futuro ILIMITADO sem novo cap; sem cor hardcoded/media query. Backend já aceita mês futuro. Dívida técnica registrada: seletor de mês DUPLICADO → extrair `MonthNavigator` compartilhado (follow-up; a duplicação causou o bug). `npm run build` verde.*
*Anterior: 2 de julho de 2026 — Web-Batch A: (#3) logo do header vira `<Link to="/dashboard">` do React Router no mobile e no desktop (client-side, cursor-pointer, focus-visible:ring-amber, aria-label); (#4) ícone de Transações mobile `↕` (U+2195, emoji colorido em iOS) → `⇄` (U+21C4, fora do conjunto emoji, monocromático como os vizinhos) — sem instalar lucide (premissa dos "vizinhos lucide" era incorreta; todos são glifos unicode). Desktop também usa `↕` mas ficou intacto (fora do escopo). `npm run build` verde.*
*Anterior: 2 de julho de 2026 — Web: SPA fallback no `vercel.json` (adicionado `rewrites` `/(.*) → /index.html`; corrige 404 em acesso direto a rotas). Todos os headers/CSP preservados; rewrites do Vercel não capturam arquivos estáticos existentes (`/assets/*`, `/sw.js`, chunks) — servidos direto do filesystem. JSON validado; `npm run build` verde.*
*Anterior: 1 de julho de 2026 — Web T-28: base URL apontada para `/api/v1` (fallback de [api.ts](../src/services/api.ts) → `http://localhost:8000/api/v1`, `.env.example` documentado dev/produção; nenhum path de service tocado — o `/api/v1` vem da `baseURL`; frontend não chama `/health`); `npm run build` verde.*
*Anterior: 30 de junho de 2026 — Web-Batch 7 / FE-11: code-splitting por rota (14 páginas em `React.lazy`, Suspense dentro do shell, `RouteFallback`); chunk inicial 1.014→294 kB (gzip 297→96, −68%), recharts e react-markdown isolados, precache PWA 7→35 entradas (offline ok); `npm run build` verde. Web-Batches 1, 2, 3, 4, 6, 7 + FE-09 + FE-12 concluídos; próximo: itens pré-deploy restantes do `PLANO_EXECUCAO_WEB.md`. Proteção de runtime via Zod leniente segue como follow-up do Web-Batch 6.*
*Projeto: Hivvo — gestão financeira pessoal com IA · Repositório FinanceAI original: github.com/lucasdonnangelo/financeai*
