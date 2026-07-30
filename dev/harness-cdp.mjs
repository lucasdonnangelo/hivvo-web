// ─────────────────────────────────────────────────────────────────────────────
// Dirige o dev/harness.html num Edge headless e LÊ O DOM. Nenhuma asserção sai
// do código-fonte: tudo é getAttribute / getComputedStyle / textContent na
// página viva — é isso que pega a reatividade que tsc e build não veem.
//
//   npm run dev                                  # em outro terminal
//   node dev/harness-cdp.mjs [url] [pasta-saída]
//
// Sem playwright/puppeteer: Node >= 22 já tem WebSocket global, e o CDP é só
// JSON sobre WS. A METADE DE CIMA (lançar, conectar, evaluate, screenshot) é
// genérica — para verificar outra tela, troque só os PROBES lá embaixo.
//
// Armadilhas que já custaram tempo:
//   · o Vite dev escuta em ::1 — use `localhost`, não `127.0.0.1` (o CDP em si
//     é 127.0.0.1 e responde normal);
//   · para o React registrar a mudança, setar o valor pelo setter do PROTÓTIPO
//     e disparar input+change com bubbles — atribuição direta não basta;
//   · dar ~250ms entre a ação e a leitura (re-render).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_ALVO = process.argv[2] ?? 'http://localhost:5173/dev/harness.html'
const OUT = process.argv[3] ?? '.'
const PORT = 9333
const EDGE =
  process.env.EDGE_BIN ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Transporte (genérico) ────────────────────────────────────────────────────
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-harness-'))}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1280,1400',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

async function targetWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* Edge ainda subindo */
    }
    await sleep(250)
  }
  throw new Error('CDP não respondeu — Edge não abriu?')
}

const ws = new WebSocket(await targetWs())
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
const erros = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.text)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
  }
}
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    pending.set(++id, { res, rej })
    ws.send(JSON.stringify({ id, method, params }))
  })

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'throw')
  return r.result.value
}

async function shot(nome) {
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  writeFileSync(join(OUT, nome), Buffer.from(data, 'base64'))
}

await send('Page.enable')
await send('Runtime.enable')

// ── Probes (específicos do StepRevisao da fatura) ────────────────────────────
const PROBES = String.raw`
window.__h = {
  sel(prefixo) {
    return [...document.querySelectorAll('select[aria-label]')]
      .find(s => s.getAttribute('aria-label').includes(prefixo)) ?? null
  },
  // Estado COMPLETO de uma linha de despesa, lido do DOM.
  probe(prefixo) {
    const sel = window.__h.sel(prefixo)
    if (!sel) return { achou: false }
    const box = sel.closest('.flex-col')
    const marca = [...box.querySelectorAll('span')].find(s => s.classList.contains('text-suggest')) ?? null
    const diamante = marca ? [...marca.querySelectorAll('span')].find(s => s.textContent.trim() === '\u25C7') : null
    return {
      achou: true,
      aria: sel.getAttribute('aria-label'),
      valor: sel.value,
      opcoes: [...sel.options].map(o => o.value),
      borderColor: getComputedStyle(sel).borderColor,
      marcaPresente: !!marca,
      marcaTexto: marca ? marca.textContent.trim() : null,
      marcaCor: marca ? getComputedStyle(marca).color : null,
      marcaFontSize: marca ? getComputedStyle(marca).fontSize : null,
      diamanteAriaHidden: diamante ? diamante.getAttribute('aria-hidden') : null,
    }
  },
  // Escolher no <select> do jeito que o React enxerga.
  pick(prefixo, valor) {
    const sel = window.__h.sel(prefixo)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, valor)
    sel.dispatchEvent(new Event('input', { bubbles: true }))
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return sel.value
  },
  clica(rotulo) {
    const b = [...document.querySelectorAll('button')].find(x =>
      (x.getAttribute('aria-label') ?? x.textContent).includes(rotulo))
    if (!b) return 'botão não encontrado'
    b.click()
    return 'ok'
  },
  // Uma seção pelo título: título, frase, linhas e o que ela NÃO tem.
  secao(tituloParcial) {
    const h = [...document.querySelectorAll('h2')].find(x => x.textContent.includes(tituloParcial))
    if (!h) return { achou: false }
    const wrap = h.parentElement
    return {
      achou: true,
      titulo: h.textContent.trim(),
      tituloCor: getComputedStyle(h).color,
      frase: wrap.querySelector('p') ? wrap.querySelector('p').textContent.trim() : null,
      linhas: [...wrap.querySelectorAll('div.rounded-md')].map(d => ({
        texto: d.textContent.trim(),
        valorCor: getComputedStyle(d.querySelector('span.shrink-0')).color,
      })),
      selects: wrap.querySelectorAll('select').length,
      marcas: wrap.querySelectorAll('.text-suggest').length,
    }
  },
  titulos() { return [...document.querySelectorAll('h2')].map(h => h.textContent.trim()) },
  layout() { return document.getElementById('harness-toggle-mobile').textContent.trim() },
  toggle() { document.getElementById('harness-toggle-mobile').click(); return true },
}
true`

const LINHAS = {
  regra: 'MERCADO DIA',
  historico: 'UBER TRIP',
  semSugestao: 'LOJA XYZ',
  desativada: 'SMART FIT',
  iofSemItem: 'IOF TRANSACAO',
}

async function carrega() {
  await send('Page.navigate', { url: URL_ALVO })
  await sleep(2500)
  await ev(PROBES)
}

// Uma rodada = baseline de todas as linhas + as 4 escolhas que mudam estado.
async function rodada() {
  const r = { layout: await ev('window.__h.layout()'), baseline: {} }
  for (const [k, p] of Object.entries(LINHAS)) r.baseline[k] = await ev(`window.__h.probe(${JSON.stringify(p)})`)

  const escolhe = async (linha, valor) => {
    const retorno = await ev(`window.__h.pick(${JSON.stringify(LINHAS[linha])}, ${JSON.stringify(valor)})`)
    await sleep(250)
    return { retorno, depois: await ev(`window.__h.probe(${JSON.stringify(LINHAS[linha])})`) }
  }
  r.escolhaDiferente = await escolhe('historico', 'Lazer')
  r.escolhaIgualASugerida = await escolhe('regra', 'Mercado') // o caso que uma condição mal escrita erra
  r.escolhaSemSugestao = await escolhe('semSugestao', 'Moradia')
  r.escolhaSobreDesativada = await escolhe('desativada', 'Lazer')
  return r
}

const rel = { url: URL_ALVO, secoes: {}, titulos: null }

await carrega()
rel.titulos = await ev('window.__h.titulos()')
rel.secoes.creditos = await ev("window.__h.secao('Entram como crédito')")
rel.secoes.fora = await ev("window.__h.secao('Não entram na importação')")
await shot('desktop-baseline.png')
rel.desktop = await rodada()
await shot('desktop-depois.png')

// Apagar → restaurar: a marca tem de VOLTAR (o usuário não tocou no seletor).
await carrega()
rel.apagarRestaurar = {
  antes: await ev(`window.__h.probe(${JSON.stringify(LINHAS.regra)})`),
  apagar: await ev("window.__h.clica('Apagar MERCADO DIA SAO PAULO')"),
}
await sleep(300)
rel.apagarRestaurar.apagada = await ev(`window.__h.probe(${JSON.stringify(LINHAS.regra)})`)
rel.apagarRestaurar.restaurar = await ev("window.__h.clica('Restaurar')")
await sleep(300)
rel.apagarRestaurar.restaurada = await ev(`window.__h.probe(${JSON.stringify(LINHAS.regra)})`)

// Mobile: linhaMobile é JSX DUPLICADO do desktop — precisa da mesma bateria.
await carrega()
await ev('window.__h.toggle()')
await sleep(400)
await shot('mobile-baseline.png')
rel.mobile = await rodada()
await shot('mobile-depois.png')

rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
