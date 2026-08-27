// ─────────────────────────────────────────────────────────────────────────────
// Verificação de LAYOUT da linha de topo do Bloco 1 (Receitas · Saídas · Saldo)
// nos dois viewports, com semente REAL. Mede com getBoundingClientRect — nada
// aqui é "olhar o screenshot e achar que está bom".
//
//   npm run dev                                  # em outro terminal
//   node dev/harness-cdp-dashboard.mjs [url] [pasta-saída]
//
// O que responde, item a item:
//   (a) os três cards e a sublinha aparecem, com os cinco números;
//   (b) a sublinha não estoura nem quebra feio a 390px — MEDIDO (scrollWidth vs
//       clientWidth do card, e nº de linhas de texto via Range.getClientRects);
//   (c) o donut sumiu da Visão geral;
//   (d) o esqueleto de carregamento mostra TRÊS caixas, não quatro.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_ALVO = process.argv[2] ?? 'http://localhost:5173/dev/harness.html'
const OUT = process.argv[3] ?? '.'
const PORT = 9336
const EDGE =
  process.env.EDGE_BIN ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-dash-'))}`,
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
ws.onmessage = (evt) => {
  const m = JSON.parse(evt.data)
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

const viewportMobile = () =>
  send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  })
const viewportDesktop = () =>
  send('Emulation.setDeviceMetricsOverride', {
    width: 1256, height: 900, deviceScaleFactor: 1, mobile: false,
  })

await send('Page.enable')
await send('Runtime.enable')

const PROBES = String.raw`
window.__d = {
  rect(el) {
    if (!el) return null
    const { x, y, width, height, top, right, bottom, left } = el.getBoundingClientRect()
    return { x, y, width, height, top, right, bottom, left }
  },
  // Card de métrica = div.bg-bg-surface que tem um <p> de label e um <p> de valor.
  cards() {
    return [...document.querySelectorAll('div.bg-bg-surface.rounded-lg')]
      .filter(d => d.querySelector('p') && /R\$/.test(d.textContent))
      .filter(d => !d.querySelector('div.bg-bg-surface'))
  },
  linha() {
    return window.__d.cards().map(c => {
      const ps = [...c.querySelectorAll('p')]
      const sub = c.querySelector('[data-testid="metric-sublinha"]')
      return {
        label: ps[0] ? ps[0].textContent.trim() : null,
        valor: ps[1] ? ps[1].textContent.trim() : null,
        sublinha: sub ? sub.textContent.trim() : null,
        rect: window.__d.rect(c),
        // Transbordo horizontal REAL do card.
        scrollWidth: c.scrollWidth,
        clientWidth: c.clientWidth,
        transborda: c.scrollWidth > c.clientWidth,
        valorLinhas: (() => {
          if (!ps[1]) return null
          const r = new Range(); r.selectNodeContents(ps[1])
          return [...r.getClientRects()].filter(x => x.width > 0).length
        })(),
      }
    })
  },
  // (b) quantas linhas de TEXTO a sublinha ocupa, e se ela cabe no card.
  sublinhaMedida() {
    const sub = document.querySelector('[data-testid="metric-sublinha"]')
    if (!sub) return { achou: false }
    const r = new Range()
    r.selectNodeContents(sub)
    const linhas = [...r.getClientRects()].filter(x => x.width > 0)
    const card = sub.closest('div.bg-bg-surface')
    const rs = window.__d.rect(sub), rc = window.__d.rect(card)
    const cs = getComputedStyle(sub)
    return {
      achou: true,
      texto: sub.textContent.trim(),
      fontSize: cs.fontSize,
      whiteSpace: cs.whiteSpace,
      overflow: cs.overflow,
      textOverflow: cs.textOverflow,
      nLinhasDeTexto: linhas.length,
      larguraTexto: Math.max(...linhas.map(l => l.width), 0),
      scrollWidth: sub.scrollWidth,
      clientWidth: sub.clientWidth,
      // Estouro = o texto passa da caixa dele, ou passa do card.
      estouraNaPropriaCaixa: sub.scrollWidth > sub.clientWidth + 1,
      saiDoCard: !!(rs && rc) && (rs.right > rc.right + 1 || rs.left < rc.left - 1),
      // Reticências invisíveis: com truncate o texto sumiria. Confirmamos que
      // NÃO ha truncamento (dinheiro cortado e pior que segunda linha).
      truncado: cs.textOverflow === 'ellipsis' && sub.scrollWidth > sub.clientWidth,
      cardRect: rc,
      subRect: rs,
    }
  },
  // (c) o donut. O da Visao geral era um <h2> "Gastos por categoria".
  donut() {
    const titulos = [...document.querySelectorAll('h2,h3')]
      .map(h => h.textContent.trim())
      .filter(t => /Gastos por categoria|Gasto por categoria/i.test(t))
    return { titulos, svgs: document.querySelectorAll('svg circle, svg path[d*="A"]').length }
  },
  // (d) esqueleto: caixas com animate-pulse dentro do primeiro grid.
  esqueleto() {
    const grid = document.querySelector('div.grid')
    if (!grid) return { achou: false }
    const caixas = [...grid.children]
    return {
      achou: true,
      gridClass: grid.className,
      nCaixas: caixas.length,
      // col-span-2 conta como UMA caixa (o Saldo ocupando a linha inteira).
      classes: caixas.map(c => c.className),
      pulsando: [...document.querySelectorAll('.animate-pulse')].length,
    }
  },
  titulos() {
    return [...document.querySelectorAll('h1,h2,h3')].map(h => h.textContent.trim())
  },
  clicar(id) {
    const b = document.getElementById(id)
    if (!b) return 'sem botao ' + id
    b.click()
    return b.textContent.trim()
  },
}
`

await send('Page.navigate', { url: URL_ALVO })
await sleep(2500)
await ev(PROBES)

const rel = { url: URL_ALVO, viewports: {} }

// Ir para o módulo dashboard (cicla: fatura→extrato→criar→onboarding→feedback→preferencia→shell→dashboard)
for (let i = 0; i < 7; i++) {
  await ev(`window.__d.clicar('harness-toggle-modulo')`)
  await sleep(120)
}
await sleep(600)
rel.moduloAtivo = await ev(
  `document.getElementById('harness-toggle-modulo').textContent.trim()`,
)

for (const [nome, setViewport] of [
  ['desktop-1256', viewportDesktop],
  ['mobile-390', viewportMobile],
]) {
  await setViewport()
  await sleep(700)
  await ev(PROBES)

  const porVariante = {}
  for (const variante of ['semente', 'medido', 'extremo', 'carregando']) {
    const rotulo = await ev(
      `document.getElementById('harness-toggle-variante').textContent.trim()`,
    )
    porVariante[rotulo.replace('valores: ', '')] = {
      linha: await ev(`window.__d.linha()`),
      sublinha: await ev(`window.__d.sublinhaMedida()`),
      esqueleto: await ev(`window.__d.esqueleto()`),
    }
    await ev(`window.__d.clicar('harness-toggle-variante')`)
    await sleep(450)
    void variante
  }

  rel.viewports[nome] = {
    titulos: await ev(`window.__d.titulos()`),
    donut: await ev(`window.__d.donut()`),
    porVariante,
  }
  await shot(`dashboard-${nome}.png`)
}

// (c, segunda metade) O donut tem que CONTINUAR na Analise. A aba vive no
// DashboardPage, fora do harness — entao lemos o SOURCE renderizado nao: lemos o
// modulo real montando Section1Detail seria outro caso de harness. Aqui
// registramos o que o harness PODE provar (sumiu da Visao geral) e deixamos a
// permanencia na Analise para a verificacao no app, abaixo.

rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio-dashboard.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
