import type { ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// MARCA DE DATA SUSPEITA — o consumo do `data_suspeita` que o backend já calcula
// nos dois fluxos de importação (fatura e extrato) e que nenhum cliente lia.
//
// O QUE ELA SINALIZA. A regra do backend é heurística: fatura = `data > emissao`;
// extrato = data fora do intervalo `periodo`. Ela acha ~1 linha em 380 — rara e
// grave, porque a data deriva a competência: a linha entra na fatura errada e a
// projeção herda o erro SEM sinal (a reconciliação não pega, ela soma VALORES e
// o valor está certo).
//
// TRÊS DECISÕES QUE ESTE MÓDULO CARREGA:
//
// 1. SINALIZA, NUNCA DECIDE. Quem chama não desmarca nem remove a linha flagada.
//    Um falso positivo que desmarcasse sozinho sumiria com uma transação real, e
//    o usuário não vê o que não está lá.
//
// 2. A MARCA VAI NA DATA (`marcaData`), não na linha inteira: é o campo em
//    questão, e marca na linha é vaga sobre QUAL campo está errado.
//
// 3. A CÓPIA DIZ A AÇÃO DISPONÍVEL. Nenhuma das duas telas edita data — `{t.data}`
//    e `{l.data}` são texto puro. Então a ação é REMOVER/DESMARCAR E LANÇAR À
//    MÃO, e nunca "confira a data": isso prometeria um conserto que a tela não
//    oferece. A cópia informa o que está inconsistente e o que dá para fazer.
//    E diz "provavelmente" porque NÃO sabemos a data certa — sem afirmar erro.
//
// Por que as duas cópias moram no mesmo arquivo: os Literals são diferentes de
// propósito (a fatura só tem limite superior; o extrato tem os dois lados), e é
// aqui que dá para VER que as frases realmente diferem por lado.
//
// Funções que RETORNAM JSX, não componentes — a mesma escolha do `marcaSugestao`
// e do `avisoRecorrencia`: chamadas como `avisoDataFatura(...)` o JSX entra
// inline na árvore, sem tipo novo por render.
// ─────────────────────────────────────────────────────────────────────────────

// Glifo próprio, deliberadamente NÃO o ⚠ das mensagens âmbar: o mesmo glifo em
// cor diferente, na mesma tela em que âmbar já significa outra coisa, é o que
// obriga o usuário a decodificar cor — o erro que o "✦ IA" âmbar já custou.
// Sem lib de ícones no projeto; unicode puro, como o ◇ da sugestão.
const GLIFO = '⚑'

// A data com a marca; sem flag, a própria string (quem chama não precisa de if).
// O glifo é aria-hidden: ele é decorativo, e quem não o vê recebe o aviso pelo
// <p> do aviso e pelo sufixo de aria-label do controle da linha.
export function marcaData(data: string, suspeita: string | null | undefined): ReactNode {
  if (!suspeita) return data
  return (
    <span className="text-suspect">
      {data}
      <span aria-hidden> {GLIFO}</span>
    </span>
  )
}

// A frase completa, irmã da linha. Mesmo glifo da data para amarrar as duas
// visualmente; mesmo formato do `avisoRecorrencia` do extrato (11px, flex).
const paragrafo = (texto: string) => (
  <p className="text-[11px] text-suspect flex items-start gap-1">
    <span aria-hidden className="mt-px">
      {GLIFO}
    </span>
    <span>{texto}</span>
  </p>
)

// Datas são exibidas em ISO na tela inteira ({t.data}, {l.data}); a cópia usa o
// MESMO formato de propósito — um segundo formato aqui obrigaria o usuário a
// casar "25/07/2026" com o "2026-07-25" que ele está lendo na linha ao lado.

// ── FATURA, seção "Despesas": um valor só no Literal ──
// O `default` não é decoração: se o backend ganhar um segundo valor (um limite
// inferior não-circular, por exemplo), a linha flagada continua avisando, com
// frase genérica, em vez de perder a marca em silêncio. É a mesma rede do
// `presentBalde`/`neutralBadge` — degradar para neutro, nunca sumir.
export function avisoDataFatura(
  suspeita: string | null | undefined,
  emissao: string | null,
): ReactNode {
  if (!suspeita) return null
  const acao = 'Esta tela não edita data: remova a linha e lance a compra à mão.'
  if (suspeita === 'posterior_a_emissao') {
    return paragrafo(
      `Data posterior à emissão da fatura${emissao ? ` (${emissao})` : ''} — provavelmente ` +
        `veio errada da extração, e a compra cairia na competência errada. ${acao}`,
    )
  }
  return paragrafo(
    `Data fora do que esta fatura permite — provavelmente veio errada da extração. ${acao}`,
  )
}

// ── FATURA, seção "Entram como crédito" (ESTORNO) ──
// O estorno também materializa, logo também ganha item de enriquecimento e TAMBÉM
// pode ser flagado — e ele É IMPORTADO, então a competência errada dele é dano
// real, não hipótese. A cópia acima não serve: a seção é read-only (não tem ✕) e
// o EditTransactionModal recusa editar estorno depois de importado.
//
// O que o USUÁRIO consegue fazer, verificado nas duas camadas — e o que decide
// esta frase é a INTERFACE, não o que a API aceitaria:
//   · EXCLUIR depois: SIM. `delete_transaction` não filtra por tipo, e o ✕ do
//     TransactionItem renderiza sem gate — o próprio EditTransactionModal já
//     manda usar excluir.
//   · RECRIAR à mão: NÃO. O AddTransactionPage é `z.enum(['receita','despesa'])`
//     e o TransactionCreatePayload nem tipa 'estorno' — o compilador barra. (O
//     POST do backend ACEITA estorno; quem não oferece é a tela.)
//
// Então a frase diz as duas metades e não maquia a que falta: dá para remover
// depois, não dá para recriar pela tela. Deliberadamente NÃO sugere reextrair —
// isso seria pedir o wizard inteiro de novo por uma linha, apostando na variação
// entre extrações, que não é coisa de expor ao usuário. A meia-ação que sobra
// está registrada como pendência (#48).
export function avisoDataEstorno(
  suspeita: string | null | undefined,
  emissao: string | null,
): ReactNode {
  if (!suspeita) return null
  const onde =
    suspeita === 'posterior_a_emissao'
      ? `Data posterior à emissão da fatura${emissao ? ` (${emissao})` : ''}`
      : 'Data fora do que esta fatura permite'
  return paragrafo(
    // Os dois nomes são os que o usuário vê: "Transações" é o rótulo de navegação
    // (Desktop/MobileLayout) e é para onde o "Concluir" do wizard já leva;
    // "Adicionar transação" é o <h1> da tela de criação. Nomear tela que não
    // existe com esse nome mandaria o usuário procurar o que não vai achar.
    `${onde} — provavelmente veio errada da extração, e este crédito entraria na ` +
      `competência errada. Esta tela não edita data nem remove crédito. Depois de ` +
      `importar, dá para excluir o lançamento em Transações — mas não dá para ` +
      `recriá-lo: a tela Adicionar transação só registra receita e despesa.`,
  )
}

// ── EXTRATO: dois valores, duas frases ──
// "anterior" contra "posterior" é o motivo de o campo ser Literal e não bool.
export function avisoDataExtrato(
  suspeita: string | null | undefined,
  periodo: { de: string; ate: string } | null,
): ReactNode {
  if (!suspeita) return null
  const faixa = periodo ? ` (${periodo.de} a ${periodo.ate})` : ''
  const acao = 'Esta tela não edita data: desmarque a linha e lance à mão.'
  const cauda = `provavelmente veio errada da extração, e o lançamento cairia no mês errado. ${acao}`
  if (suspeita === 'antes_do_periodo')
    return paragrafo(`Data anterior ao período do extrato${faixa} — ${cauda}`)
  if (suspeita === 'depois_do_periodo')
    return paragrafo(`Data posterior ao período do extrato${faixa} — ${cauda}`)
  return paragrafo(`Data fora do período do extrato${faixa} — ${cauda}`)
}

// ── Sufixo de aria-label ──
// Vai no CONTROLE da linha (o <select> da fatura, o checkbox do extrato), que é
// onde o leitor de tela para em modo de foco — o mesmo lugar em que a marca ◇ da
// categoria já se anuncia. Curto de propósito: a frase inteira está no <p>, que o
// modo de leitura anuncia; repeti-la aqui faria o usuário ouvir tudo duas vezes.
export function ariaDataFatura(suspeita: string | null | undefined): string {
  if (!suspeita) return ''
  return suspeita === 'posterior_a_emissao'
    ? ' — atenção: data posterior à emissão da fatura'
    : ' — atenção: data fora do que esta fatura permite'
}

export function ariaDataExtrato(suspeita: string | null | undefined): string {
  if (!suspeita) return ''
  if (suspeita === 'antes_do_periodo') return ' — atenção: data anterior ao período do extrato'
  if (suspeita === 'depois_do_periodo') return ' — atenção: data posterior ao período do extrato'
  return ' — atenção: data fora do período do extrato'
}
