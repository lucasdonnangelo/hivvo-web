// ─────────────────────────────────────────────────────────────────────────────
// Probe DEDICADO ao #43 (seletor de categoria na linha de crédito/estorno da
// fatura). Transporte GENÉRICO copiado de dev/harness-cdp.mjs (ver o cabeçalho
// de lá) — só os probes abaixo são novos.
//
//   npm run dev                                          # em outro terminal
//   node dev/harness-cdp-credito.mjs [url] [pasta-saída]
//
// Verifica, nos DOIS viewports (1256 e 390, via Emulation.setDeviceMetricsOverride
// — StepRevisao recebe isMobile por PROP, então o toggle do harness tem de
// acompanhar a largura, não substituí-la):
//   (a) escolher categoria na linha de crédito muda window.__faturaPayload()
//       (probe injetado em dev/harness.tsx, espelha a linha `categoria` de
//       buildPayload em ImportFaturaPage.tsx — MESMOS helpers, mesmo estado);
//   (b) sem tocar em nada, a linha de crédito manda categoria:null;
//   (c) o <select> novo não colide com o ⚑ de #46 na linha "ESTORNO COMPRA
//       CANCELADA" (única linha do mock com os dois: ver dev/harness.tsx,
//       enriquecimento idx 3) — retângulos via getBoundingClientRect;
//   (d) nenhuma linha de DESPESA muda de apagada/restaurada por causa disto;
//   (e) "Não entram na importação" continua sem <select> nenhum.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_ALVO = process.argv[2] ?? 'http://localhost:5173/dev/harness.html'
const OUT = process.argv[3] ?? '.'
const PORT = 9334
const EDGE =
  process.env.EDGE_BIN ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Transporte (genérico, ver dev/harness-cdp.mjs) ──────────────────────────
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-harness-credito-'))}`,
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

async function evaluate(expr) {
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

// ── Probes específicos do #43 ────────────────────────────────────────────────
const PROBES = String.raw`
window.__c43 = {
  linhaEstorno() {
    return [...document.querySelectorAll('div.rounded-md')]
      .filter(e => e.textContent.includes('ESTORNO COMPRA CANCELADA'))
      .sort((a, b) => a.textContent.length - b.textContent.length)[0] ?? null
  },
  selectEstorno() {
    const l = window.__c43.linhaEstorno()
    return l ? l.querySelector('select') : null
  },
  estadoEstorno() {
    const l = window.__c43.linhaEstorno()
    if (!l) return { achou: false }
    const sel = l.querySelector('select')
    const marca = l.querySelector('span.text-suggest')
    const aviso = l.querySelector('p.text-suspect')
    return {
      achou: true,
      temSelect: !!sel,
      selectValor: sel ? sel.value : null,
      selectOpcoes: sel ? [...sel.options].map(o => o.value) : null,
      selectAria: sel ? sel.getAttribute('aria-label') : null,
      temMarcaSugestao: !!marca,
      marcaTexto: marca ? marca.textContent.trim() : null,
      temAvisoData: !!aviso,
      avisoTexto: aviso ? aviso.textContent.trim() : null,
    }
  },
  pickEstorno(valor) {
    const sel = window.__c43.selectEstorno()
    if (!sel) return 'sem select'
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, valor)
    sel.dispatchEvent(new Event('input', { bubbles: true }))
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return sel.value
  },
  // (c) três pares de retângulo: aviso×marca, aviso×select, marca×select.
  colisao() {
    const l = window.__c43.linhaEstorno()
    if (!l) return { achou: false }
    const aviso = l.querySelector('p.text-suspect')
    const marca = l.querySelector('span.text-suggest')
    const sel = l.querySelector('select')
    const rect = (el) => el ? (({ x, y, width, height, top, right, bottom, left }) =>
      ({ x, y, width, height, top, right, bottom, left }))(el.getBoundingClientRect()) : null
    const intersect = (a, b) => !!(a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top))
    const rAviso = rect(aviso), rMarca = rect(marca), rSelect = rect(sel)
    return {
      achou: true,
      temTodos: !!(aviso && marca && sel),
      colideAvisoMarca: intersect(rAviso, rMarca),
      colideAvisoSelect: intersect(rAviso, rSelect),
      colideMarcaSelect: intersect(rMarca, rSelect),
      rects: { aviso: rAviso, marca: rMarca, select: rSelect },
    }
  },
  // (d) despesas: quais estão marcadas 'removida' agora (texto renderizado).
  despesasRemovidas() {
    return [...document.querySelectorAll('div.rounded-md, tr')]
      .filter(e => /\bremovida\b|Restaurar linha|^Restaurar$/.test(e.textContent))
      .map(e => e.textContent.trim().slice(0, 60))
  },
  // (e) a seção "Não entram na importação" não pode ganhar select nenhum.
  secaoForaSelects() {
    const h = [...document.querySelectorAll('h2')].find(x => x.textContent.includes('Não entram na importação'))
    if (!h) return null
    return h.parentElement.querySelectorAll('select').length
  },
  secaoCreditoSelects() {
    const h = [...document.querySelectorAll('h2')].find(x => x.textContent.includes('Entram como crédito'))
    if (!h) return null
    return h.parentElement.querySelectorAll('select').length
  },
  layout() { return document.getElementById('harness-toggle-mobile').textContent.trim() },
}
true`

async function carrega() {
  await send('Page.navigate', { url: URL_ALVO })
  await sleep(2500)
  await evaluate(PROBES)
}

async function setViewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  })
  await sleep(150)
}

// Uma rodada completa nas verificações (a)-(e), num viewport já setado e com o
// prop isMobile já no estado desejado (toggle clicado ANTES de chamar).
async function rodada(rotulo) {
  const r = { layout: await evaluate('window.__c43.layout()') }

  r.payloadAntesDeQualquerCoisa = await evaluate('window.__faturaPayload()')
  r.estadoEstornoAntes = await evaluate('window.__c43.estadoEstorno()')
  r.colisao = await evaluate('window.__c43.colisao()')
  r.despesasRemovidasAntes = await evaluate('window.__c43.despesasRemovidas()')
  r.secaoForaSelectsAntes = await evaluate('window.__c43.secaoForaSelects()')
  r.secaoCreditoSelects = await evaluate('window.__c43.secaoCreditoSelects()')
  await shot(`credito-${rotulo}-antes.png`)

  // (a) escolher categoria no crédito muda o payload.
  r.pick = await evaluate('window.__c43.pickEstorno("Vestuário")')
  await sleep(250)
  r.estadoEstornoDepois = await evaluate('window.__c43.estadoEstorno()')
  r.payloadDepoisDeEscolher = await evaluate('window.__faturaPayload()')
  await shot(`credito-${rotulo}-depois.png`)

  // (d) nenhuma decisão de importar (apagar/restaurar despesa) mudou.
  r.despesasRemovidasDepois = await evaluate('window.__c43.despesasRemovidas()')
  // (e) a seção fora-da-importação continua sem select.
  r.secaoForaSelectsDepois = await evaluate('window.__c43.secaoForaSelects()')

  return r
}

const rel = { url: URL_ALVO, erros: [] }

// ── Desktop: 1256×900 ─────────────────────────────────────────────────────
await carrega()
await setViewport(1256, 900, false)
rel.desktop = await rodada('desktop')

// ── Mobile: 390×844, com o prop isMobile também virado ──────────────────────
await carrega()
await setViewport(390, 844, true)
await evaluate('document.getElementById("harness-toggle-mobile").click()')
await sleep(300)
rel.mobile = await rodada('mobile')

rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio-credito.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
