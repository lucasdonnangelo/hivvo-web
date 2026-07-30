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
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import StepRevisao from '../src/pages/Import/fatura/StepRevisao'
import { mapEnriquecimento } from '../src/pages/Import/fatura/helpers'
import type {
  EnriquecimentoFaturaLinha,
  FaturaExtraida,
  ReconciliacaoFatura,
} from '../src/services/importFatura'

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
  transacoes: [
    { data: '2026-06-18', descricao: 'MERCADO DIA SAO PAULO', valor_brl: '89.90', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-06-20', descricao: 'UBER TRIP SP', valor_brl: '23.40', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-06-22', descricao: 'LOJA XYZ 4471', valor_brl: '149.00', tipo: 'compra', parcela: { indice: 2, total: 6 }, portador_final: '9876', internacional: null },
    { data: '2026-06-25', descricao: 'ESTORNO COMPRA CANCELADA', valor_brl: '-50.00', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-06-30', descricao: 'PAGAMENTO FATURA ANTERIOR', valor_brl: '-1200.00', tipo: 'pagamento', parcela: null, portador_final: null, internacional: null },
    { data: '2026-07-02', descricao: 'SMART FIT ACADEMIA', valor_brl: '320.00', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-07-05', descricao: 'IOF TRANSACAO INTERNACIONAL', valor_brl: '4.32', tipo: 'iof', parcela: null, portador_final: '1234', internacional: null },
    { data: '2026-07-10', descricao: 'AJUSTE DE SALDO', valor_brl: '0.02', tipo: 'ajuste_saldo', parcela: null, portador_final: null, internacional: null },
    { data: '2026-07-12', descricao: 'COMPRA VALOR ZERO', valor_brl: '0.00', tipo: 'compra', parcela: null, portador_final: '1234', internacional: null },
  ],
}

const enriquecimento: EnriquecimentoFaturaLinha[] = [
  { indice: 0, categoria_sugerida: 'Mercado', origem_sugestao: 'regra' },
  { indice: 1, categoria_sugerida: 'Transporte', origem_sugestao: 'historico' },
  { indice: 2, categoria_sugerida: null, origem_sugestao: null },
  { indice: 3, categoria_sugerida: 'Vestuário', origem_sugestao: 'historico' },
  // 'Academia' foi DESATIVADA entre o preview e agora: não está em categoriaOptions.
  { indice: 5, categoria_sugerida: 'Academia', origem_sugestao: 'regra' },
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

// Espelha o reducer de ImportFaturaPage (SET_CATEGORIA / TOGGLE_APAGAR) — a
// reatividade sob teste nasce daqui, então o estado tem de ter a mesma forma.
function Harness() {
  const [isMobile, setIsMobile] = useState(false)
  const [categorias, setCategorias] = useState<Record<number, string>>({})
  const [apagadas, setApagadas] = useState<Record<number, true>>({})

  return (
    <div style={{ padding: 24, maxWidth: 768, margin: '0 auto' }}>
      <button
        id="harness-toggle-mobile"
        onClick={() => setIsMobile((v) => !v)}
        style={{
          marginBottom: 16,
          fontSize: 12,
          color: '#EF9F27',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        layout: {isMobile ? 'mobile' : 'desktop'}
      </button>
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
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Harness />)
