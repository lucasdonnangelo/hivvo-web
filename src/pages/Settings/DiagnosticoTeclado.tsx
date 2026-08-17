import { useCallback, useEffect, useState } from 'react'

// ─── INSTRUMENTO TEMPORÁRIO — REMOVER ────────────────────────────────────────
//
// Este bloco NÃO é feature. Ele existe para medir UM defeito no iPhone: depois
// de fechar o teclado, a barra inferior fica parada na altura onde estava a
// borda do teclado e sobra um bloco morto embaixo. Nenhum harness reproduz isso
// (CDP emula viewport, não teclado; e o defeito é do WebKit, não do Chromium),
// então o único instrumento possível é a tela do próprio aparelho.
//
// ASSIM QUE A FOTO EXISTIR, APAGUE:
//   1. este arquivo;
//   2. o <Section> que o monta, em SettingsPage.tsx (busque por
//      "DiagnosticoTeclado").
// Não há mais nada preso nele — sem store, sem rede, sem chave em storage.
//
// POR QUE MEDIR ANTES DE CORRIGIR: há três mecanismos possíveis e cada um pede
// uma correção diferente. Os números abaixo separam os três:
//
//   • `clientHeight` encolheu e NÃO voltou  → o layout viewport foi
//     redimensionado. A correção mexe na cadeia `height: 100%` (index.css).
//   • `clientHeight` voltou, mas `offsetTop` ou `scrollY` ficaram > 0 → é o pan
//     do visual viewport que não foi restaurado. A correção é resetar no
//     fechamento, e não encostar na cadeia de altura.
//   • os três voltaram ao valor inicial, mas `nav.bottom` ficou menor que
//     `clientHeight` → o problema está na cadeia flex do MobileLayout, e nada
//     acima adianta.
//
// Enquanto esses números não existirem, escolher uma correção é chute.
// ─────────────────────────────────────────────────────────────────────────────

interface Leitura {
  clientHeight: number
  vvHeight: number | null
  vvOffsetTop: number | null
  scrollY: number
  navBottom: number | null
}

const arred = (n: number) => Math.round(n)

function ler(): Leitura {
  const vv = window.visualViewport
  // A barra de abas do MobileLayout. No AuthLayout não existe <nav> — a linha
  // aparece como "—", e isso é informação, não falha.
  const nav = document.querySelector('nav')
  return {
    clientHeight: arred(document.documentElement.clientHeight),
    vvHeight: vv ? arred(vv.height) : null,
    vvOffsetTop: vv ? arred(vv.offsetTop) : null,
    scrollY: arred(window.scrollY),
    navBottom: nav ? arred(nav.getBoundingClientRect().bottom) : null,
  }
}

const LINHAS: [keyof Leitura, string][] = [
  ['clientHeight', 'documentElement.clientHeight'],
  ['vvHeight', 'visualViewport.height'],
  ['vvOffsetTop', 'visualViewport.offsetTop'],
  ['scrollY', 'window.scrollY'],
  ['navBottom', 'barra inferior · bottom'],
]

const fmt = (v: number | null) => (v === null ? '—' : String(v))

export default function DiagnosticoTeclado() {
  const [inicial, setInicial] = useState<Leitura>(ler)
  const [agora, setAgora] = useState<Leitura>(ler)

  const recapturar = useCallback(() => {
    const l = ler()
    setInicial(l)
    setAgora(l)
  }, [])

  useEffect(() => {
    // A captura INICIAL é feita aqui, não no `useState` acima: o inicializador
    // do useState roda ANTES de o React commitar o DOM, e nessa hora a <nav>
    // ainda não existe — a coluna "inicial" da barra inferior vinha "—" (visto
    // no harness, não deduzido). Como é justamente a linha que responde "a barra
    // voltou ao lugar?", uma medição sem baseline seria uma foto inútil.
    //
    // Por rAF, e não chamada direta: medir exige o DOM já pintado, e um setState
    // síncrono dentro do efeito encadeia render (o lint reclama, com razão).
    const raf = requestAnimationFrame(recapturar)

    const atualiza = () => setAgora(ler())
    const vv = window.visualViewport

    vv?.addEventListener('resize', atualiza)
    vv?.addEventListener('scroll', atualiza)
    window.addEventListener('resize', atualiza)
    window.addEventListener('scroll', atualiza)
    // Além dos eventos: o estado QUE INTERESSA é o que fica DEPOIS que tudo
    // parou de disparar, e é justamente aí que pode não vir evento nenhum. O
    // intervalo garante que a foto mostre o valor final, não o penúltimo.
    const timer = window.setInterval(atualiza, 500)

    return () => {
      cancelAnimationFrame(raf)
      vv?.removeEventListener('resize', atualiza)
      vv?.removeEventListener('scroll', atualiza)
      window.removeEventListener('resize', atualiza)
      window.removeEventListener('scroll', atualiza)
      window.clearInterval(timer)
    }
  }, [recapturar])

  const mudou = (k: keyof Leitura) => inicial[k] !== agora[k]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-muted">
        Bloco temporário de medição. Toque no campo abaixo, feche o teclado e
        tire uma foto desta tela. <span className="text-text-primary">Ele será
        removido assim que a medição existir</span> — não é uma configuração.
      </p>

      <input
        type="text"
        inputMode="text"
        placeholder="Toque aqui para abrir o teclado"
        aria-label="Campo de teste: abre o teclado para a medição"
        className="w-full rounded-md bg-bg border border-bg-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-amber transition-colors"
      />

      <div className="rounded-md bg-bg border border-bg-border divide-y divide-bg-border">
        <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          <span className="flex-1">medida</span>
          <span className="w-14 text-right">inicial</span>
          <span className="w-14 text-right">agora</span>
        </div>
        {LINHAS.map(([chave, rotulo]) => (
          <div key={chave} className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 text-xs text-text-muted break-all">{rotulo}</span>
            <span className="w-14 text-right text-xs tabular-nums text-text-muted">
              {fmt(inicial[chave])}
            </span>
            {/* Destacar o que MUDOU é o ponto: numa foto de tela pequena, a
                diferença entre duas colunas de números some. */}
            <span
              className={`w-14 text-right text-xs tabular-nums ${
                mudou(chave) ? 'text-amber font-semibold' : 'text-text-primary'
              }`}
            >
              {fmt(agora[chave])}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={recapturar}
        className="self-start px-3 py-1.5 rounded-md text-xs font-medium border border-bg-border text-text-primary hover:bg-bg-border transition-colors"
      >
        Zerar e medir de novo
      </button>
    </div>
  )
}
