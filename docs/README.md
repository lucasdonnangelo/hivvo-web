# docs/ — atenção: a maior parte desta pasta é GERADA

O Hivvo vive em dois repositórios. Os documentos compartilhados são **canônicos
no `hivvo-api`** e copiados para cá por um script.

## A regra

> **Não edite os compartilhados aqui.** Edite em `hivvo-api/docs` e rode o sync:
> `python scripts/sync-docs.py` (no hivvo-api). Nunca copie à mão.

Qualquer edição feita nos arquivos abaixo é **perdida no próximo sync**. Foi a
cópia manual que fez estes docs divergirem entre os repos.

## Compartilhados (gerados — canônicos em `hivvo-api/docs`)

`DECISAO_A_PAGAR_SALDO.md` · `ENGINEERING.md` · `Hivvo_Referencia.md` ·
`PLANO_3D_PAGAMENTO_FATURA.md` · `PLANO_DASHBOARD_DOIS_BLOCOS.md` ·
`PLANO_IMPORTACAO.md` · `PLANO_PERFIL_CONFIG.md` · `PLANO_PROJECAO.md` ·
`PLANO_RESUMO.md`

Detalhes e a tabela completa: `hivvo-api/docs/README.md`.

## `img/` — espelhado À MÃO

As capturas de `docs/img/` estão duplicadas byte a byte nos dois repos e **fora
da lista `SHARED`** do `sync-docs.py`, então o `--check` não olha para elas:
quem atualizar uma captura tem de copiá-la para o `hivvo-api` no mesmo commit,
senão a versão nova chega num lado só e nada acusa.

## Específicos deste repo

Só este `README.md`, que não é sincronizado.

## Documentação operacional (fora deste repositório)

A auditoria do frontend, o diário de sessão e o plano de execução saíram deste
repositório em 24/08/2026 e passaram a viver num **repositório privado
separado**, junto com o backlog priorizado e o estado geral do projeto.

**São privados porque descrevem um sistema em produção.** O que fica aqui é o
que descreve o produto e as decisões de desenho. Nada do que saiu é necessário
para entender, construir ou rodar este código.
