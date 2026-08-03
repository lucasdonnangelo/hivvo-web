// ─────────────────────────────────────────────────────────────────────────────
// HARNESS DE DESENVOLVIMENTO — monta um componente SOZINHO, com dados mockados
// em memória. Sem backend, sem auth, sem Gemini: nada é salvo, nada sai daqui.
//
// Existe para verificar REATIVIDADE em browser de verdade — a classe de bug que
// `tsc`, lint e build não veem (estado que não some, borda que não acompanha,
// aria-label que congela). Foi ela que pegou o CardFormModal e a marca ◇ da
// categoria sugerida.
//
//   Rodar:  npm run dev  →  http://localhost:5173/dev/harness.html
//   Dirigir headless:     node dev/harness-cdp.mjs <url> <pasta-de-saída>
//
// Por que fora de src/ e fora da raiz — as três portas para produção estão
// fechadas por CONSTRUÇÃO, não por disciplina:
//   1. build: o entry é só o index.html da RAIZ (vite.config.ts não define
//      build.rollupOptions.input), e nenhum módulo do app importa este arquivo;
//   2. tsc -b: tsconfig.app.json inclui só "src" — um harness quebrado nunca
//      pode travar o build de produção;
//   3. Tailwind: content é ['./index.html', './src/**'], então este arquivo não
//      gera CSS. Por isso o invólucro daqui usa style inline: o harness não
//      pode inventar uma classe que a produção não teria — o que ele mostra é
//      o CSS real do app.
// ─────────────────────────────────────────────────────────────────────────────
/* eslint-disable react-refresh/only-export-components --
   Este arquivo é um ENTRY POINT (define o componente e monta), como o
   main.tsx do app: não exporta porque ninguém o importa. A regra protege o
   fast-refresh de arquivo de app; aqui ela pediria um export inútil. */
import { useState, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import StepRevisao from '../src/pages/Import/fatura/StepRevisao'
import { mapEnriquecimento } from '../src/pages/Import/fatura/helpers'
import type {
  EnriquecimentoFaturaLinha,
  FaturaExtraida,
  ReconciliacaoFatura,
} from '../src/services/importFatura'
import StepRevisaoExtrato from '../src/pages/Import/extrato/StepRevisao'
import {
  defaultImportar,
  mapEnriquecimento as mapEnriquecimentoExtrato,
} from '../src/pages/Import/extrato/helpers'
import type {
  EnriquecimentoLinha,
  ExtratoExtraido,
  ReconciliacaoExtrato,
} from '../src/services/importExtrato'

// Só tipos vêm de services/importFatura — `import type` some na compilação, então
// nem axios nem o interceptor de auth entram no grafo. O harness é read-only por
// construção, não por promessa.

// Um caso por linha, incluindo os degenerados:
//   0 sugestão de REGRA · 1 sugestão de HISTÓRICO · 2 sem sugestão (→ Outros)
//   3 ESTORNO (entra como crédito) · 4 pagamento (fora) · 5 sugestão apontando
//   para categoria DESATIVADA · 6 iof SEM item de enriquecimento · 7 ajuste_saldo
//   8 compra de VALOR ZERO (não materializa: fora, e não é estorno)
const fatura: FaturaExtraida = {
  banco: 'Banco Mock',
  competencia: { mes: 7, ano: 2026 },
  periodo: { de: '2026-06-15', ate: '2026-07-14' },
  emissao: '2026-07-15',
  vencimento: '2026-07-22',
  total_a_pagar: '536.60',
  total_compras_periodo: '532.28',
  total_iof_periodo: '4.32',
  // As datas das linhas 0, 3 e 5 são POSTERIORES à emissão (2026-07-15) — é o que
  // as torna flagáveis, e o fora-de-ordem resultante é fiel ao bug real: a linha
  // que deveria ser 06-29 saiu 07-29 e ficou no lugar da 06-29.
  transacoes: [
    { data: '2026-07-16', descricao: 'MERCADO DIA SAO PAULO', valor_brl: '89.90', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-06-20', descricao: 'UBER TRIP SP', valor_brl: '23.40', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-06-22', descricao: 'LOJA XYZ 4471', valor_brl: '149.00', tipo: 'compra', parcela: { indice: 2, total: 6 }, portador_final: '9876', internacional: null },
    { data: '2026-07-18', descricao: 'ESTORNO COMPRA CANCELADA', valor_brl: '-50.00', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-06-30', descricao: 'PAGAMENTO FATURA ANTERIOR', valor_brl: '-1200.00', tipo: 'pagamento', parcela: null, portador_final: null, internacional: null },
    { data: '2026-07-19', descricao: 'SMART FIT ACADEMIA', valor_brl: '320.00', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-07-05', descricao: 'IOF TRANSACAO INTERNACIONAL', valor_brl: '4.32', tipo: 'iof', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-07-10', descricao: 'AJUSTE DE SALDO', valor_brl: '0.02', tipo: 'ajuste_saldo', parcela: null, portador_final: null, internacional: null },
    { data: '2026-07-12', descricao: 'COMPRA VALOR ZERO', valor_brl: '0.00', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
  ],
}

// `data_suspeita` reproduz o caso REAL que originou a regra: a fatura foi emitida
// em 2026-07-15 e a linha 5 (SMART FIT, 2026-07-16) cai DEPOIS disso.
//   idx 0 → tem ◇ sugerida E ⚑ data suspeita: é a linha que prova que as duas
//           marcas não colidem (o único jeito de verificar isso é ter as duas).
//   idx 5 → flagada COM sugestão de categoria desativada (dois eixos de uma vez).
//   idx 3 → ESTORNO flagado: importado, read-only e sem conserto em lugar nenhum.
//   idx 1/2 → sem flag: o contraste que prova que a marca não vaza para todos.
const enriquecimento: EnriquecimentoFaturaLinha[] = [
  { indice: 0, categoria_sugerida: 'Mercado', origem_sugestao: 'regra', data_suspeita: 'posterior_a_emissao' },
  { indice: 1, categoria_sugerida: 'Transporte', origem_sugestao: 'historico', data_suspeita: null },
  { indice: 2, categoria_sugerida: null, origem_sugestao: null, data_suspeita: null },
  { indice: 3, categoria_sugerida: 'Vestuário', origem_sugestao: 'historico', data_suspeita: 'posterior_a_emissao' },
  // 'Academia' foi DESATIVADA entre o preview e agora: não está em categoriaOptions.
  { indice: 5, categoria_sugerida: 'Academia', origem_sugestao: 'regra', data_suspeita: 'posterior_a_emissao' },
  // idx 6 (iof) ausente de propósito: "ausente = linha sem sugestão".
]

const reconciliacao: ReconciliacaoFatura = {
  ancora: '586.62',
  soma_gastos: '586.62',
  excluidos: '-1250.00',
  total_a_pagar: '536.60',
  diferenca: '0.00',
  bate: true,
  diferenca_secundaria: '0.00',
  bate_secundario: true,
}

// Espelha o useMemo da página: categorias ATIVAS + 'Outros' garantido. 'Academia'
// não entra — é o que faz a linha 5 exercitar o opcoesCom.
const categoriaOptions = ['Outros', 'Mercado', 'Transporte', 'Moradia', 'Lazer', 'Vestuário']

const enrMap = mapEnriquecimento(enriquecimento)

// ─── EXTRATO ─────────────────────────────────────────────────────────────────
// `periodo: null` de propósito: o editor de período só RENDERIZA quando o extrato
// não imprime o período, e sem ele não há como verificar que editar a âncora
// limpa os flags. A combinação (periodo null + flags presentes) não sai do
// backend hoje — sem âncora ele não calcula flag nenhum — e é exatamente por isso
// que ela precisa ser forçada aqui: o que está sob teste é o front LIMPAR flags,
// e essa limpeza tem de funcionar mesmo se o contrato mudar. `periodoDoDocumento`
// guarda a faixa que a cópia cita, já que `extrato.periodo` é null.
const extrato: ExtratoExtraido = {
  banco: 'Banco Mock',
  periodo: null,
  saldo_inicial: '1000.00',
  saldo_final: '1443.10',
  rendimento: '12.50',
  linhas: [
    // 0 receita SEM flag (o contraste: a marca não vaza para todas as linhas)
    { data: '2026-07-05', descricao: 'SALARIO EMPRESA X', valor: '5000.00', balde: 'receita', cartao_citado: null },
    // 1 débito ANTES do período
    { data: '2026-06-11', descricao: 'MERCADO BOM PRECO', valor: '210.35', balde: 'debito', cartao_citado: null },
    // 2 débito DEPOIS do período (a cópia tem de diferir da linha 1)
    { data: '2026-08-22', descricao: 'FARMACIA CENTRAL', valor: '89.70', balde: 'debito', cartao_citado: null },
    // 3 débito sem flag
    { data: '2026-07-14', descricao: 'POSTO IPIRANGA', valor: '150.00', balde: 'debito', cartao_citado: null },
    // 4 PAGAMENTO DE FATURA flagado (card próprio, JSX que não é o das outras)
    { data: '2026-08-30', descricao: 'PAGTO FATURA CARTAO NUBANK', valor: '536.60', balde: 'pagamento_fatura', cartao_citado: 'Nubank' },
    // 5 receita flagada E com recorrência casada: o ⚠ âmbar e o ⚑ na mesma linha
    { data: '2026-06-02', descricao: 'SALARIO EMPRESA X ADIANTAMENTO', valor: '1200.00', balde: 'receita', cartao_citado: null },
  ],
}

// Alternável no botão `harness-toggle-periodo`: com o período PRESENTE a cópia
// cita a faixa e o editor não renderiza; com ele NULO o editor aparece e dá para
// verificar a limpeza dos flags. Os dois estados são reais, e nenhum sozinho
// cobre as duas coisas.
const periodoDoDocumento = { de: '2026-07-01', ate: '2026-07-31' }

const enriquecimentoExtrato: EnriquecimentoLinha[] = [
  { indice: 0, categoria_sugerida: 'Salário', fatura_proposta: null, provavel_recorrencia: false, recorrencia_casada: null, data_suspeita: null },
  { indice: 1, categoria_sugerida: 'Mercado', fatura_proposta: null, provavel_recorrencia: false, recorrencia_casada: null, data_suspeita: 'antes_do_periodo' },
  { indice: 2, categoria_sugerida: 'Saúde', fatura_proposta: null, provavel_recorrencia: false, recorrencia_casada: null, data_suspeita: 'depois_do_periodo' },
  { indice: 3, categoria_sugerida: 'Transporte', fatura_proposta: null, provavel_recorrencia: false, recorrencia_casada: null, data_suspeita: null },
  {
    indice: 4,
    categoria_sugerida: null,
    fatura_proposta: {
      status: 'match_unico',
      candidatas: [
        { cartao_id: 1, cartao_nome: 'Nubank', fatura_mes: 7, fatura_ano: 2026, total_fatura: '536.60', diferenca: '0.00', valor_bate: true, ja_paga: false },
      ],
      motivo: null,
    },
    provavel_recorrencia: false,
    recorrencia_casada: null,
    data_suspeita: 'depois_do_periodo',
  },
  {
    indice: 5,
    categoria_sugerida: 'Salário',
    fatura_proposta: null,
    provavel_recorrencia: true,
    recorrencia_casada: { id: 'r1', descricao: 'Salário', categoria: 'Salário', valor_vigente: '5000.00', dia_do_mes: 5, competencia_mes: 7, competencia_ano: 2026 },
    data_suspeita: 'antes_do_periodo',
  },
]

const reconciliacaoExtrato: ReconciliacaoExtrato = {
  aplicavel: true,
  saldo_inicial: '1000.00',
  rendimento: '12.50',
  soma_receitas: '6200.00',
  soma_debitos: '450.05',
  soma_pagamentos_fatura: '536.60',
  saldo_final_calc: '6225.85',
  saldo_final_declarado: '6225.85',
  diferenca: '0.00',
  bate: true,
}

const enrMapExtrato = mapEnriquecimentoExtrato(enriquecimentoExtrato)

const botao: CSSProperties = {
  fontSize: 12,
  color: '#EF9F27',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
}

// Espelha o reducer de ImportFaturaPage (SET_CATEGORIA / TOGGLE_APAGAR) e o de
// ImportExtratoPage (TOGGLE_IMPORTAR / SET_CATEGORIA / SET_CANDIDATA /
// SET_PERIODO) — a reatividade sob teste nasce daqui, então o estado tem de ter
// a mesma forma. `periodoEditado` em especial: é ele que limpa os flags de data,
// e um harness que o derivasse de outro jeito testaria outra coisa.
function Harness() {
  const [isMobile, setIsMobile] = useState(false)
  const [modulo, setModulo] = useState<'fatura' | 'extrato'>('fatura')

  const [categorias, setCategorias] = useState<Record<number, string>>({})
  const [apagadas, setApagadas] = useState<Record<number, true>>({})

  const [periodoNulo, setPeriodoNulo] = useState(true)
  const [importar, setImportar] = useState<Record<number, boolean>>(() => {
    const seed: Record<number, boolean> = {}
    extrato.linhas.forEach((l, idx) => {
      seed[idx] = defaultImportar(l, enrMapExtrato.get(idx))
    })
    return seed
  })
  const [categoriasEx, setCategoriasEx] = useState<Record<number, string>>({})
  const [candidataEscolhida, setCandidata] = useState<Record<number, number>>({})
  const [periodoDe, setPeriodoDe] = useState('2026-06-02')
  const [periodoAte, setPeriodoAte] = useState('2026-08-30')
  const [periodoEditado, setPeriodoEditado] = useState(false)

  const extratoAtual: ExtratoExtraido = {
    ...extrato,
    periodo: periodoNulo ? null : periodoDoDocumento,
  }

  return (
    <div style={{ padding: 24, maxWidth: 768, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <button id="harness-toggle-mobile" onClick={() => setIsMobile((v) => !v)} style={botao}>
          layout: {isMobile ? 'mobile' : 'desktop'}
        </button>
        <button
          id="harness-toggle-modulo"
          onClick={() => setModulo((m) => (m === 'fatura' ? 'extrato' : 'fatura'))}
          style={botao}
        >
          módulo: {modulo}
        </button>
        {modulo === 'extrato' && (
          <button
            id="harness-toggle-periodo"
            onClick={() => setPeriodoNulo((v) => !v)}
            style={botao}
          >
            período do documento: {periodoNulo ? 'ausente' : '2026-07-01 a 2026-07-31'}
          </button>
        )}
      </div>

      {modulo === 'fatura' ? (
        <StepRevisao
          isMobile={isMobile}
          fatura={fatura}
          reconciliacao={reconciliacao}
          enriquecimento={enrMap}
          categorias={categorias}
          apagadas={apagadas}
          categoriaOptions={categoriaOptions}
          onSetCategoria={(idx, cat) => setCategorias((s) => ({ ...s, [idx]: cat }))}
          onToggleApagar={(idx) =>
            setApagadas((s) => {
              const n = { ...s }
              if (n[idx]) delete n[idx]
              else n[idx] = true
              return n
            })
          }
        />
      ) : (
        <StepRevisaoExtrato
          isMobile={isMobile}
          extrato={extratoAtual}
          reconciliacao={reconciliacaoExtrato}
          enriquecimento={enrMapExtrato}
          importar={importar}
          categorias={categoriasEx}
          candidataEscolhida={candidataEscolhida}
          categoriasReceita={['Outros', 'Salário', 'Rendimentos']}
          categoriasDespesa={['Outros', 'Mercado', 'Saúde', 'Transporte', 'Moradia']}
          importarRendimento
          periodoFaltante={extratoAtual.periodo === null}
          periodoDe={periodoDe}
          periodoAte={periodoAte}
          datasNaoReverificadas={periodoEditado}
          onToggleImportar={(idx) => setImportar((s) => ({ ...s, [idx]: !s[idx] }))}
          onSetCategoria={(idx, cat) => setCategoriasEx((s) => ({ ...s, [idx]: cat }))}
          onSetCandidata={(idx, i) => setCandidata((s) => ({ ...s, [idx]: i }))}
          onToggleRendimento={() => {}}
          onSetPeriodo={(campo, valor) => {
            // Igual ao SET_PERIODO do reducer: marca editado e nunca desmarca.
            if (campo === 'de') setPeriodoDe(valor)
            else setPeriodoAte(valor)
            setPeriodoEditado(true)
          }}
          error=""
        />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
