# PLANO_PERFIL_CONFIG.md — Separação Perfil vs Configurações

> Documento de design. Fecha O QUE cada tela é antes de qualquer código.
> Problema: o SettingsPage virou depósito — mistura identidade (nome/senha), conta/LGPD (logout,
> Termos), dados de gestão (categorias, recorrências) e ferramentas (importar/exportar, resetar IA).
> Uma tela só, 8 seções, sem eixo: "quem sou eu" e "como uso o app" no mesmo rolo.
>
> ⚠️ A premissa original deste doc dizia que havia "DOIS pontos de entrada sobrepostos: o menu do
> ícone de perfil (Importar/Backup/Categorias/Config/Termos) e o próprio SettingsPage". **Isso era
> falso** (ver INVENTÁRIO): o ponto de entrada era UM só — o ícone chamava `navigate('/settings')`
> direto. Aqueles "5 itens" eram as seções DE DENTRO do SettingsPage. A fonte do erro era o
> Hivvo_Referencia.md, já corrigido.

## DECISÃO ESTRUTURAL: DUAS TELAS (não três)
- **Perfil** = "quem sou eu" (identidade, segurança, sessão). Pequeno e coeso; entra-se raramente.
- **Configurações** = "como uso o app" (dados de gestão, ferramentas, meus dados).
Três telas (Perfil + Preferências + Gerenciar-dados) seria over-engineering para o tamanho atual.

## NAVEGAÇÃO
O ícone de perfil (header mobile / sidebar desktop) abre um **menu enxuto**: **Perfil** |
**Configurações** | **Sair**. Cada destino organiza suas coisas dentro.

> ⚠️ Este menu **NASCE no BATCH 1 — não substitui nada**. Não havia menu nenhum antes: o ícone
> chamava `navigate('/settings')` direto. É componente NOVO (`components/layout/ProfileMenu.tsx`),
> não a reforma de um menu existente. ✅ Implementado no BATCH 1.

## PERFIL — "quem sou eu"
- **Nome** (editável — UM campo, aceita nome completo). NÃO dividir em nome/sobrenome: exigiria
  migration e o campo atual já aceita "Lucas Donnangelo". Se um dia precisar do primeiro nome
  (saudação), `nome.split(' ')[0]` resolve sem migration.
  - 🐛 **BUG CORRIGIDO no BATCH 1: o campo "Nome" editava o `username`, não o `nome_completo`.**
    O SettingsPage fazia `useState(user?.username ?? '')` e o `updateMe` mandava `{username}` — ou
    seja, sob o rótulo "Nome" o usuário vinha editando um identificador interno, auto-gerado do
    e-mail, que o plano decidiu nem sequer expor. (Ironia: o `PUT /auth/me` só aceitava `username`,
    então os dois lados estavam consistentemente errados — foi o que mascarou o bug.)
    **Consequência visível:** para quem já editou aquele campo, o valor exibido no Perfil MUDA
    (ex.: `lucas.donnangelo` → `Lucas Donnangelo`), porque agora mostra o campo certo. **É a
    correção aparecendo, não uma regressão** — o `nome_completo` sempre esteve lá, vindo do
    cadastro, apenas nunca era exibido nem editável.
  - **`nome_completo` NUNCA é NULL:** `nullable=False` desde a migration inicial (`abdb546095c0`) e
    obrigatório no `RegisterRequest` — não há conta antiga sem nome. Mas o `RegisterRequest` não tem
    `min_length`, então uma chamada DIRETA à API consegue gravar `""` (a UI exige 2+). Por isso o
    avatar usa `initialDoUsuario(nome, email)` (`lib/userInitial.ts`), com fallback
    `nome → email → '?'`. O padrão ANTIGO (`user?.username?.[0].toUpperCase() ?? '?'`) **estourava**
    com string vazia: `""[0]` é `undefined` e o `?? '?'` nunca chegava a rodar — o throw vinha antes.
- **E-mail** (READ-ONLY). Não há fluxo de troca de e-mail hoje; editável seria feature de backend →
  backlog.
- **NÃO expor o username.** É auto-gerado do e-mail, artefato interno, sem função visível (login é
  por e-mail; finanças pessoais não têm perfil público/compartilhamento). Expor criaria um campo
  decorativo com custo real (unicidade, colisão, 409 na UI). Se surgir função para ele, ganha edição
  junto com a feature.
- **Trocar senha.**
- **Sair de todos os dispositivos** (NOVO): revoga todas as sessões (`refresh_tokens`). Ação de
  segurança que apps financeiros sempre têm ("perdi meu celular"). Backend pequeno, alto valor.
- **Sair.**
- **Termos e Privacidade.**

## CONFIGURAÇÕES — "como uso o app"
Ordem: **Categorias · Recorrências · Assistente IA · Meus dados** (+ **Sobre** no BATCH 2).
- **Categorias** (as duas seções por tipo, com os "+" próprios — já implementado, só migra de lugar).
- **Recorrências** (a Section completa: listar/editar/encerrar/corrigir-valor/apagar permanente —
  já implementado, só migra de lugar).
- **Assistente IA** — "Resetar Assistente" (`clearHistorico` → apaga o histórico do chat). **JÁ
  EXISTE** hoje no SettingsPage; o plano original OMITIA esta seção e ela sumiria calada. Migra de
  lugar INTACTA, como Categorias/Recorrências. Fica em **seção própria, NÃO dentro de "Meus dados"**:
  é "como uso o app", não identidade — e diluiria o peso de alerta das ações irreversíveis (excluir
  conta / começar do zero), que devem ficar sozinhas nesse bloco.
- **Meus dados** (agrupa entrada/saída/eliminação — a natureza LGPD: acesso + eliminação):
  - **Importar CSV** — mantido: a feature JÁ FUNCIONA (ver investigação abaixo).
  - **Exportar transações (JSON)** (rótulo honesto — ver investigação; o nome do arquivo baixado
    também deixa de ser `hivvo-backup-*.json`, pela mesma razão).
  - **Começar do zero** (NOVO — BATCH 2; backend `POST /auth/reset-data` já pronto).
  - **Excluir minha conta** — ⚠️ **NÃO "sai do Perfil": ela NUNCA existiu na UI.** `DELETE /auth/me`
    existe no backend desde o F-07, mas não era chamado em lugar nenhum do frontend (não havia
    `deleteMe` em `services/auth.ts`). É **construção NOVA**, feita no BATCH 1: modal com
    reautenticação por senha (o backend exige), e no sucesso `clearAuth()` + `/login` — sem chamar
    logout, porque a conta e a sessão já não existem no servidor.
  - Racional: as duas ações irreversíveis (zerar + excluir) ficam JUNTAS, mesmo peso de alerta, em
    vez de espalhadas por duas telas.
- **Sobre** (NOVO, rodapé): número da versão + ajuda/contato. Útil de verdade — quando alguém
  reportar bug, você precisa saber a versão.

## "COMEÇAR DO ZERO" — decisões
- **Reset TOTAL, nunca seletivo.** Reset seletivo é parcialmente IMPOSSÍVEL no modelo: `transacoes.
  cartao_id` e `parcelas.cartao_id` são NO ACTION (o banco BLOQUEIA deletar cartão com compras — e
  isso é DELIBERADO, o T-14 as deixou fora do cascade de propósito: soft delete de cartão); e "só
  transações" deixaria `pagamentos_fatura` órfãos + parcelas penduradas. Cada combinação seletiva
  abre um estado inconsistente diferente.
- **PRESERVA o `usuario_id`** — zera os dados, mantém a conta. NUNCA deletar+recriar o usuário.
- **PRESERVA as categorias customizadas** (decidido) e os tokens (o usuário CONTINUA LOGADO).
- **ORDEM CORRETA (confirmada nas migrations — a ordem que o delete_me já usa):**
  `parcelas → transacoes → pagamentos_fatura → cartoes → recorrencia_vigencias → recorrencias →
  chat_messages`. (`parcelas.transacao_id → transacoes` é CASCADE, então parcelas saem ANTES. As
  duas NO ACTION em `cartoes` são o eixo: os deletes têm de ser explícitos e nessa ordem; não dá
  para apoiar no banco, pois nenhum cascade cobre o caminho de `cartoes` e o `usuario_id` sobrevive
  por definição no reset.)
- **TUDO NUM ÚNICO `session.commit()`** — tudo-ou-nada; erro no meio faz rollback. Commit em etapas
  deixaria estado parcial (usuário sem transações mas com cartões).
- **`chat_messages` entra na purga:** o histórico do chat referencia lançamentos por texto; zerar sem
  limpá-lo deixa a IA conversando sobre transações que não existem mais.
- **FUNÇÃO DE PURGA COMPARTILHADA** (decidido): `_purgar_dados_do_usuario(uid, session)` usada por
  `delete_me` E pelo reset. Razão: o furo atual nasceu de dois lugares que deveriam ser um — o
  `delete_me` ESQUECEU `recorrencias`/`recorrencia_vigencias` (hoje só o `ON DELETE CASCADE` do
  Postgres salva; o teste não pega porque o conftest não tem `PRAGMA foreign_keys` e o SQLite não
  força FK). Uma função = um lugar para errar. `delete_me` = purga + `categorias → refresh_tokens →
  password_reset_tokens → usuarios`; reset = só a purga.

## DECISÕES DA INVESTIGAÇÃO (13/07/2026)
- **`PUT /auth/me` hoje edita `username`, NÃO `nome_completo`** — o inverso do que a UI precisa (e o
  `username` é obrigatório no schema, então a UI nem conseguiria chamar). DECISÃO: adicionar
  `nome_completo` e tornar AMBOS `Optional` com `exclude_unset` (só atualiza o que veio); validar que
  ao menos um veio. NÃO aposentar o username (fica editável para um cliente futuro, custo zero).
  `UserResponse` já devolve `nome_completo` → o GET da tela já funciona.
- **"Backup" MENTE hoje:** `GET /transactions/export` traz SÓ transações (sem cartões, parcelas,
  recorrências, categorias, pagamentos) — restaurar a partir dele não reconstrói a conta. DECISÃO:
  o rótulo vira **"Exportar transações (JSON)"** (honesto, zero backend). Um `/export/full` de
  verdade entra JUNTO com a importação (backup sem restore é meio-caminho) → backlog.
- **Importar CSV NÃO EXISTE** (nenhuma rota, nenhum UploadFile; PLANO_IMPORTACAO.md ainda "EM
  DESENHO"). O item NÃO entra na UI agora — nasce com a feature (como Aparência e Notificações).
- **"Sair de todos os dispositivos": a função JÁ EXISTE** (`revoke_all_refresh_tokens` em
  core/auth.py, usada por change_password/reset_password) — falta só a rota (`POST /auth/logout-all`,
  ~10 linhas, sem migration/schema).
  ⚠️ **TEXTO HONESTO:** o access token é JWT stateless e vive até 30 min → os outros dispositivos
  seguem funcionando até lá. Expulsão instantânea exigiria checar revogação a cada request — outro
  projeto. (A redação sugerida aqui na investigação — "Encerra as outras sessões" — pressupunha a
  **opção B**, que mantinha ESTA sessão viva. **Fomos de opção A**: ver a redação final em
  §DECISÕES DA EXECUÇÃO.)
- **Trocar senha (`PUT /auth/password`) JÁ revoga todas as sessões** (inclusive a atual) na mesma
  transação. ⚠️ Mas o access token atual sobrevive ~30 min → a UI DEVE fazer **logout explícito**
  após o 204, senão o usuário fica num limbo.
- **Versão:** o backend tem `version="0.1.0"` hardcoded, mas só sai pelo `/openapi.json`, que está
  DESATIVADO em produção; o `/health` é genérico de propósito (F-14). DECISÃO: usar a versão do
  **frontend** (é o que o usuário está olhando ao reportar bug) via `import.meta.env.VITE_APP_VERSION`
  (package.json ou SHA do commit no build). NÃO tocar o backend.

## INVENTÁRIO DO SettingsPage (varredura 14/07/2026) — o que EXISTE hoje vs. o plano
Varredura completa do arquivo (todas as `<Section>`, todos os modais, todas as chamadas de serviço).
São **8 seções** e **12 ações vivas**. A lista abaixo é fechada — não há uma nona.

| # | Seção (hoje) | Ação viva | O plano previa? | Destino |
|---|---|---|---|---|
| 1 | Perfil | Nome (input+Salvar) | sim | **Perfil** |
| 2 | Perfil | E-mail (read-only) | sim | **Perfil** |
| 3 | Perfil | Alterar senha | sim | **Perfil** (+ logout explícito) |
| 4 | Perfil | Sair da conta | sim | **Perfil** + menu |
| 5 | Categorias de despesa | listar/adicionar/remover | sim | **Configurações** |
| 6 | Categorias de receita | listar/adicionar/remover | sim | **Configurações** |
| 7 | Recorrências | listar/editar/alterar-vs-corrigir valor/encerrar/apagar permanente | sim | **Configurações** |
| 8 | Importar dados | Importar CSV → `/import` | **NÃO** (mandava excluir) | **Config. → Meus dados** |
| 9 | Exportar dados | Exportar JSON | sim ("Backup") | **Config. → Meus dados** |
| 10 | Assistente IA | Resetar Assistente | **NÃO** (omitida) | **Config. → seção própria** |
| 11 | Legal | Termos de Uso → `/terms` | sim | **Perfil** |
| 12 | Legal | Política de Privacidade → `/privacy` | sim | **Perfil** |

**Duas features vivas o plano não mapeou** (8 e 10) — ambas sumiriam caladas. Resolvidas acima.

### FANTASMAS — o plano supunha que existiam, mas NÃO existem
- **O "menu de 5 itens" do ícone de perfil NÃO EXISTE.** Em `MobileLayout.tsx` e `DesktopLayout.tsx`
  o ícone chama `navigate('/settings')` DIRETO — não há dropdown algum. Os "5 itens" que o plano
  descreve são, na verdade, as SEÇÕES DE DENTRO do SettingsPage. Consequência: **não há sobreposição
  de dois pontos de entrada** (há UM só), e o menu enxuto não "substitui" nada — ele é **CRIADO**
  (componente novo).
- **"Excluir minha conta" NÃO EXISTE na UI.** `DELETE /auth/me` não é chamado em lugar nenhum do
  frontend (não há `deleteMe` em `services/auth.ts`). Não "SAI do Perfil": nasce agora, com modal de
  reautenticação por senha.

### BUGS REAIS ENCONTRADOS (entram no BATCH 1)
- **O campo "Nome" edita o `username`, não o `nome_completo`.** `useState(user?.username ?? '')` +
  `updateMe` mandando `{username}`. O usuário vem editando o username achando que é o nome. Ao
  corrigir, o valor exibido MUDA para quem já editou (ex.: `lucas.donnangelo` → `Lucas Donnangelo`)
  — é a correção, não uma regressão.
- **O avatar usa `username[0]`** nos dois layouts → passa a `nome_completo[0]` (o plano decidiu não
  expor o username).
- **`UserResponse` do frontend não tem `nome_completo`** (`{id, email, username}`), enquanto o
  backend devolve `{id, email, username, nome_completo, criado_em, ativo}`. Há ainda um tipo inline
  duplicado em `services/api.ts` (refresh) a alinhar.
- **Trocar senha NÃO faz logout hoje** — só toast de sucesso. É o limbo de ~30 min descrito acima.

### BACKEND — status real (commit 9921075, JÁ MERGEADO em master)
`PUT /auth/me` (aceita `nome_completo`), `DELETE /auth/me`, `POST /auth/reset-data`,
`POST /auth/logout-all` e a purga compartilhada estão **prontos e no master**. O BATCH 2 já tem
backend; não falta nada de API para ele.

## DECISÕES DA EXECUÇÃO — as que a UI precisa obedecer
> ⚠️ Estas decisões nasceram no hivvo-api (§EXECUÇÃO BACKEND do MESMO doc, lá) e **não estavam
> nesta cópia** — que seguia mandando a redação da opção B (descartada) no §INVESTIGAÇÃO. Um doc,
> duas cópias, uma delas mentindo. Sincronizado em 15/07/2026; ao mudar uma, mude a outra.

- **`logout-all` limpa os cookies desta sessão (opção A).** Motivo decisivo não é semântico:
  `revoke_all_refresh_tokens` revoga TAMBÉM o refresh deste dispositivo, então preservar o cookie
  deixaria o cliente com um token morto na mão. Descartada a opção B (emitir refresh novo para este
  dispositivo, mantendo-o logado).
  **➡️ RÓTULO LITERAL:** **"Sair de todos os dispositivos"** — este INCLUÍDO. O aviso dos ~30 min
  continua valendo, mas é sobre os OUTROS:
  > "Você sairá de todos os dispositivos, incluindo este. Outros dispositivos podem levar até 30
  > minutos para serem desconectados."

  ⚠️ **NÃO USAR "Encerra as outras sessões"**: era a redação da opção B (que mantinha esta sessão
  viva) e, com a A, **mente** — o usuário sai daqui junto.
- **Reset responde `200` com recibo**, não `204`: ação irreversível merece extrato ("apagamos 143
  transações, 3 cartões"), e o `rowcount` já vem do DELETE → zero query extra. O `delete_me` segue
  `204` (o corpo não teria para quem ir).
- **Reset NÃO limpa cookies** — o usuário CONTINUA LOGADO (com teste-guarda no backend).

## NÃO ENTRA AGORA (backlog, com escopo real)
- **Preferências / Aparência (tema claro + acessibilidade)**: NÃO criar a seção vazia hoje. Tema
  claro = revisar CADA cor de CADA componente (o app inteiro foi construído sobre tokens escuros +
  âmbar; as cores dos gráficos Recharts foram escolhidas para fundo escuro) — semanas, não um
  toggle. Acessibilidade (contraste WCAG, fontes maiores = todo layout fluido em rem, ditado) = cada
  item é um projeto. É uma FASE, não uma config. A seção "Aparência" nasce JUNTO com a feature.
- **Notificações** ("avisar quando a fatura vence" — feature forte para um app de parcelamento): não
  há push hoje. Seção não nasce vazia; nasce com a feature.
- **Trocar e-mail**: exigiria backend (verificação, unicidade).

## ORDEM DE EXECUÇÃO
1. ✅ **Investigação** — feita (ver DECISÕES DA INVESTIGAÇÃO + INVENTÁRIO).
2. ✅ **Backend** — commit `9921075`, mergeado em master: `PUT /auth/me` (aceita `nome_completo`),
   `POST /auth/reset-data`, `POST /auth/logout-all`, purga compartilhada. Nada falta de API.
3. ✅ **Frontend BATCH 1 (estrutura)** — 14/07/2026:
   - `components/layout/ProfileMenu.tsx` (NOVO) — menu Perfil · Configurações · Sair, nos dois layouts.
   - `pages/Profile/ProfilePage.tsx` (NOVO, rota `/profile`) — nome editável (`nome_completo`),
     e-mail read-only, trocar senha **com logout explícito**, sair, Termos e Privacidade.
   - `pages/Settings/SettingsPage.tsx` — Categorias · Recorrências · Assistente IA (as três MOVIDAS
     intactas) + Meus dados (Importar CSV · Exportar transações JSON · Excluir minha conta).
   - `components/ui/SettingsSection.tsx` (NOVO) — `Section`/`SettingsRow` extraídas, usadas pelas duas
     telas (duplicar o markup faria uma divergir da outra na primeira mudança).
   - `lib/userInitial.ts` (NOVO) — inicial do avatar com fallback `nome → email → '?'`.
   - Contratos: `UserResponse` alinhado ao backend (+`nome_completo`, `criado_em`, `ativo`);
     `updateMe` manda `{nome_completo}`; `deleteMe(password)` nasce; tipo inline duplicado do
     `/auth/refresh` em `services/api.ts` eliminado.
4. ✅ **Frontend BATCH 2** — 15/07/2026:
   - **Perfil → "Sair de todos os dispositivos"** (entre Alterar senha e Sair da conta): `logoutAll()`
     → `POST /auth/logout-all` (204) → `clearAuth()` + `/login`. NÃO chama `POST /auth/logout` antes:
     o backend já revogou tudo e limpou os cookies desta sessão — seria bater numa sessão morta.
     Confirmação em **Modal, sem senha**: sem senha porque é disruptivo mas reversível (basta entrar
     de novo); Modal e não confirm inline porque o irmão direto ("Sair da conta", logo abaixo) já é
     Modal — inline faria a ação mais disruptiva das duas parecer a mais leve. O padrão inline aqui é
     para itens DENTRO de lista (remover categoria, encerrar recorrência), não para ações de página.
   - **Configurações → Meus dados → "Começar do zero"** (acima de Excluir conta): `resetData(password)`
     → `POST /auth/reset-data` (200 + recibo). Modal de dois estados: senha → recibo. **NÃO desloga.**
     - **O recibo é o próprio modal** (some o campo de senha, entra a lista + "Fechar"), não um toast:
       toast some em segundos e trunca as linhas — e o recibo é justamente o motivo de a rota ser 200.
     - **`recorrencia_vigencias` fica FORA do recibo** (`RECIBO_LABELS`): é o versionamento interno de
       valor de uma recorrência — o usuário nunca viu isso como objeto e "2 vigências" não significa
       nada para ele. Os outros 6 aparecem, com plural pt-BR, escondendo os zerados; tudo zero →
       "Não havia dados para apagar".
     - Invalidação: **`qc.invalidateQueries()` sem filtro** — o reset zera tudo, e enumerar as 8
       chaves só criaria uma lista para esquecer de atualizar quando nascer a próxima query.
   - **Configurações → "Sobre"** (rodapé): versão + `contato@hivvo.app` (o mesmo endereço dos Termos
     e da Privacidade). Não consulta o backend.
   - **Versão no build** (`vite.config.ts`): `define` substitui `import.meta.env.VITE_APP_VERSION` por
     `${pkg.version} (${sha})` — sha = `VERCEL_GIT_COMMIT_SHA` na Vercel, senão `git rev-parse --short
     HEAD`, com fallback `dev` (build fora de um checkout git não pode quebrar por causa do rodapé).
     Escolhido `define` em vez de setar `process.env.VITE_APP_VERSION` dentro do config: a variante
     process.env depende da ordem interna em que o Vite chama `loadEnv` depois de carregar o arquivo —
     funciona, mas é frágil. `package.json` foi de `0.0.0` → **`0.1.0`** (alinha com o `version` do
     backend; um "Sobre" exibindo `0.0.0` não serve ao propósito dele). `src/vite-env.d.ts` NASCE aqui
     — sem ele `import.meta.env.VITE_API_URL` só typechecava por cair no index signature de
     `vite/client`, ou seja, como `any`.
