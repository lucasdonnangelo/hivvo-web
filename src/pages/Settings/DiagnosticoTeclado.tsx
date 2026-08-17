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
// PREMISSA DERRUBADA NO APARELHO — ler antes do resto.
//
// A primeira versão deste bloco foi desenhada sobre um raciocínio que o telefone
// desmentiu: como `html/body/#root` são `height: 100%` e a coluna do shell fecha
// exatamente 100%, o documento NÃO teria overflow (`scrollHeight ===
// clientHeight`), e daí o WebKit faria *pan* do visual viewport em vez de rolar.
// Era daí que saía a hipótese principal.
//
// O aparelho mostrou barra de rolagem do DOCUMENTO e duas a três telas de vazio
// abaixo. Ou seja: existe overflow real. A premissa estava errada, e com ela caiu
// a árvore de três ramos — nenhum deles descrevia "o documento ficou mais alto".
// Por isso entraram os dois `scrollHeight`: são eles que separam este caso, e é
// por isso que a leitura tem QUATRO ramos agora, não três.
//
// POR QUE MEDIR ANTES DE CORRIGIR: cada ramo pede uma correção diferente, e três
// deles seriam a correção errada para os outros. Os números abaixo separam:
//
//   • `scrollHeight` MAIOR que `clientHeight` → o documento ganhou altura de
//     verdade. Não é a cadeia `height: 100%` e não é pan: alguém está
//     transbordando, e a correção é achar QUEM. A linha "mais alto que o
//     viewport" existe para isso — ela nomeia os elementos que passam do fundo.
//   • `clientHeight` encolheu e NÃO voltou → o layout viewport foi
//     redimensionado. A correção mexe na cadeia `height: 100%` (index.css).
//   • `clientHeight` voltou, mas `offsetTop` ou `scrollY` ficaram > 0 → é o pan
//     do visual viewport que não foi restaurado. A correção é resetar no
//     fechamento, e não encostar na cadeia de altura.
//   • todos voltaram ao valor inicial, mas `nav.bottom` ficou menor que
//     `clientHeight` → o problema está na cadeia flex do MobileLayout, e nada
//     acima adianta.
//
// Os ramos não são exclusivos: se `scrollHeight` estourar E `scrollY` ficar > 0,
// o segundo é consequência do primeiro (dá para rolar porque há o que rolar) —
// leia o overflow primeiro.
//
// Enquanto esses números não existirem, escolher uma correção é chute.
// ─────────────────────────────────────────────────────────────────────────────

interface Leitura {
  clientHeight: number
  docScrollHeight: number
  bodyScrollHeight: number
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
    // Os dois, e não um: eles discordam quando o transbordo vem de dentro do
    // body (o body cresce) contra quando vem de algo posicionado fora dele. A
    // diferença entre os dois já é pista.
    docScrollHeight: arred(document.documentElement.scrollHeight),
    bodyScrollHeight: arred(document.body.scrollHeight),
    vvHeight: vv ? arred(vv.height) : null,
    vvOffsetTop: vv ? arred(vv.offsetTop) : null,
    scrollY: arred(window.scrollY),
    navBottom: nav ? arred(nav.getBoundingClientRect().bottom) : null,
  }
}

// ── Quem está transbordando ──────────────────────────────────────────────────
//
// Barato porque só roda QUANDO HÁ overflow (o caminho normal nem entra aqui) e
// só no tique de 500ms — nunca no `scroll`, que dispararia a varredura a cada
// quadro do dedo arrastando.
//
// Reporta só os elementos MAIS INTERNOS que transbordam: quem contém outro
// transbordante é continente, não culpado, e listar a cadeia inteira
// (html > body > div > div…) esconderia o culpado no meio do caminho.
//
// O critério é conter, e não "transbordar menos". Comparar os fundos parecia
// mais preciso e não é: no harness o continente apareceu ANTES do culpado
// (fundo 2951 contra 2935) só por causa do próprio padding de baixo. Padding de
// pai não é transbordo — quem estica é o filho.
function descreve(el: Element): string {
  const cls = (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join('.')
  const id = el.id ? `#${el.id}` : ''
  return `${el.tagName.toLowerCase()}${id}${cls ? '.' + cls : ''}`.slice(0, 68)
}

function culpados(limite: number): string[] {
  const achados: { el: Element; fundo: number; altura: number }[] = []
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const r = el.getBoundingClientRect()
    if (r.height === 0 && r.width === 0) continue
    const fundo = arred(r.bottom + window.scrollY)
    if (fundo <= limite + 1) continue
    achados.push({ el, fundo, altura: arred(r.height) })
  }
  return achados
    .filter((a) => !achados.some((b) => b !== a && a.el.contains(b.el)))
    .sort((x, y) => y.fundo - x.fundo)
    .slice(0, 3)
    .map((a) => `${descreve(a.el)} — fundo ${a.fundo}, alt ${a.altura}`)
}

const LINHAS: [keyof Leitura, string][] = [
  ['clientHeight', 'documentElement.clientHeight'],
  ['docScrollHeight', 'documentElement.scrollHeight'],
  ['bodyScrollHeight', 'body.scrollHeight'],
  ['vvHeight', 'visualViewport.height'],
  ['vvOffsetTop', 'visualViewport.offsetTop'],
  ['scrollY', 'window.scrollY'],
  ['navBottom', 'barra inferior · bottom'],
]

const fmt = (v: number | null) => (v === null ? '—' : String(v))

export default function DiagnosticoTeclado() {
  const [inicial, setInicial] = useState<Leitura>(ler)
  const [agora, setAgora] = useState<Leitura>(ler)
  const [quemTransborda, setQuemTransborda] = useState<string[]>([])

  const recapturar = useCallback(() => {
    const l = ler()
    setInicial(l)
    setAgora(l)
    setQuemTransborda([])
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
    //
    // A varredura de culpados mora AQUI, e não em `atualiza`: no `scroll` ela
    // rodaria a cada quadro do dedo arrastando. E só entra quando há transbordo
    // — no caminho normal o custo é uma comparação de dois inteiros.
    const timer = window.setInterval(() => {
      const l = ler()
      setAgora(l)
      setQuemTransborda(l.docScrollHeight > l.clientHeight ? culpados(l.clientHeight) : [])
    }, 500)

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

      {/* Só aparece quando há transbordo — no caminho saudável a tela não ganha
          uma linha vazia para o Lucas interpretar. */}
      {quemTransborda.length > 0 && (
        <div className="rounded-md bg-bg border border-bg-border px-3 py-2 flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber">
            mais alto que o viewport
          </p>
          {quemTransborda.map((linha) => (
            <p key={linha} className="text-[11px] text-text-primary break-all leading-snug">
              {linha}
            </p>
          ))}
        </div>
      )}

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
