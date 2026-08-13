// ─────────────────────────────────────────────────────────────────────────────
// Dirige o módulo `onboarding` do dev/harness.html num Edge headless e LÊ O DOM.
//
//   npm run dev                                             # em outro terminal
//   node dev/harness-cdp-onboarding.mjs [url] [pasta-saída]
//
// Arquivo SEPARADO do harness-cdp.mjs (que dirige a revisão de fatura/extrato)
// pelo motivo que o cabeçalho daquele já anuncia: "para verificar outra tela,
// troque só os PROBES". A metade de cima é a mesma de lá, deliberadamente
// duplicada — extrair um transporte comum mexeria num driver que funciona, para
// ganhar 60 linhas, no meio de outra tarefa.
//
// A DIFERENÇA que importa está no `viewport()`: aqui a viewport é EMULADA
// (Emulation.setDeviceMetricsOverride), não simulada encolhendo um container.
// Um layout mobile dentro de uma janela de 1280px é uma terceira coisa que não
// existe em aparelho nenhum — mede quebras de linha que ninguém vê. O banner
// recebe `isMobile` por prop, então o driver muda OS DOIS: a prop (pelo botão do
// harness) e a viewport real.
//
// Armadilhas herdadas: o Vite dev escuta em ::1 (use `localhost`), e dar ~250ms
// entre ação e leitura para o React re-renderizar.
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

// ── Transporte ───────────────────────────────────────────────────────────────
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-onb-'))}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1280,900',
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

// A viewport de VERDADE. `mobile: true` também muda o comportamento de layout
// (largura do scrollbar, unidades viewport), não só o número de pixels.
const VIEWPORTS = {
  desktop: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
}
const viewport = (nome) => send('Emulation.setDeviceMetricsOverride', VIEWPORTS[nome])

await send('Page.enable')
await send('Runtime.enable')

// ── Probes ───────────────────────────────────────────────────────────────────
// Tudo lido da página viva: getComputedStyle, getBoundingClientRect,
// textContent. Nada é conferido contra o código-fonte.
const PROBES = String.raw`
window.__o = {
  banner() { return document.querySelector('ol') ? document.querySelector('ol').closest('div.rounded-xl') : null },
  presente() { return !!window.__o.banner() },

  // Fundo EFETIVO: o pixel que o olho recebe atrás do glifo.
  //
  // Não basta subir até a primeira cor não-transparente: a marca do passo tem
  // fundo TRANSLÚCIDO (success/15 sobre o card), e devolver 'rgba(61,191,127,
  // .15)' cru faria o contraste dar 1:1 — verde contra verde, número fantasia.
  // Aqui as camadas são coletadas até a primeira OPACA e compostas de baixo
  // para cima, que é o que o compositor do browser faz.
  fundo(el) {
    const camadas = []
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor
      if (!c || c === 'transparent') continue
      const m = (c.match(/[\d.]+/g) ?? []).map(Number)
      if (m.length < 3) continue
      const a = m.length > 3 ? m[3] : 1
      if (a === 0) continue
      camadas.push([m[0], m[1], m[2], a])
      if (a === 1) break
    }
    // Sem nenhuma opaca no caminho, o que sobra é o branco da página.
    if (camadas.length === 0 || camadas[camadas.length - 1][3] !== 1) camadas.push([255, 255, 255, 1])
    let [r, g, b] = camadas[camadas.length - 1]
    for (let i = camadas.length - 2; i >= 0; i--) {
      const [cr, cg, cb, ca] = camadas[i]
      r = cr * ca + r * (1 - ca)
      g = cg * ca + g * (1 - ca)
      b = cb * ca + b * (1 - ca)
    }
    return 'rgb(' + Math.round(r) + ', ' + Math.round(g) + ', ' + Math.round(b) + ')'
  },

  // Estado COMPLETO de um passo, do jeito que a tela o entrega.
  passo(i) {
    const li = document.querySelectorAll('ol > li')[i]
    if (!li) return { achou: false }
    const marca = li.querySelector('span[aria-hidden]')
    const srOnly = li.querySelector('span.sr-only')
    const ps = li.querySelectorAll('p')
    const botoes = [...li.querySelectorAll('button')]
    const principal = botoes[botoes.length - 1]
    const alternativa = botoes.length > 1 ? botoes[0] : null
    const r = li.getBoundingClientRect()
    return {
      achou: true,
      glifo: marca ? marca.textContent.trim() : null,
      glifoCor: marca ? getComputedStyle(marca).color : null,
      glifoFundo: marca ? window.__o.fundo(marca) : null,
      // O estado que chega a quem não enxerga cor nem glifo.
      leitorDeTela: srOnly ? srOnly.textContent.replace(/\s+/g, ' ').trim() : null,
      titulo: ps[0] ? ps[0].textContent.trim() : null,
      tituloCor: ps[0] ? getComputedStyle(ps[0]).color : null,
      tituloFundo: ps[0] ? window.__o.fundo(ps[0]) : null,
      tituloPx: ps[0] ? getComputedStyle(ps[0]).fontSize : null,
      desc: ps[1] ? ps[1].textContent.trim() : null,
      botaoPrincipal: principal ? principal.textContent.trim() : null,
      // Sólido âmbar = "sua próxima ação". É a cor de FUNDO que distingue.
      botaoFundo: principal ? getComputedStyle(principal).backgroundColor : null,
      botaoBorda: principal ? getComputedStyle(principal).borderColor : null,
      alternativa: alternativa ? alternativa.textContent.trim() : null,
      // Empilhou (mobile) ou ficou na mesma linha (desktop)? Medido, não suposto.
      alturaLinha: r.height,
      // Estourou a própria caixa? (texto/botão sem lugar na largura real)
      overflow: li.scrollWidth - li.clientWidth,
    }
  },

  todos() { return [...document.querySelectorAll('ol > li')].map((_, i) => window.__o.passo(i)) },

  // Só UM passo pode estar sólido em âmbar.
  quantosSolidos() {
    return [...document.querySelectorAll('ol > li')].filter((li) => {
      const bs = [...li.querySelectorAll('button')]
      const b = bs[bs.length - 1]
      return b && getComputedStyle(b).backgroundColor === 'rgb(239, 159, 39)'
    }).length
  },

  rota() {
    const p = document.getElementById('harness-rota')
    return p ? p.textContent.replace('rota: ', '').trim() : null
  },
  analiseAberta() { return document.body.dataset.analiseAberta ?? 'nao' },

  clica(rotulo) {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? x.textContent).includes(rotulo))
    if (!b) return 'botão não encontrado: ' + rotulo
    b.click()
    return 'ok'
  },

  // A página inteira rolou para o lado? Em 390px isso é defeito visível.
  overflowDaPagina() { return document.documentElement.scrollWidth - window.innerWidth },
  larguraReal() { return { innerWidth: window.innerWidth, dpr: devicePixelRatio } },

  modulo() { return document.getElementById('harness-toggle-modulo').textContent.trim() },
  trocaModulo() { document.getElementById('harness-toggle-modulo').click(); return true },
  layout() { return document.getElementById('harness-toggle-mobile').textContent.trim() },
  trocaLayout() { document.getElementById('harness-toggle-mobile').click(); return true },
  cartao() { return document.getElementById('harness-toggle-cartao').textContent.trim() },
  trocaCartao() { document.getElementById('harness-toggle-cartao').click(); return true },
  historico() { return document.getElementById('harness-toggle-historico').textContent.trim() },
  trocaHistorico() { document.getElementById('harness-toggle-historico').click(); return true },
}

// Contraste WCAG 2.x sobre a cor de fundo efetiva — o ✓ é texto de 12px, então
// o piso é 4,5:1 (AA), não 3:1.
window.__c = {
  rgb(s) { return s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number) },
  lin(c) { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) },
  lum(s) { const [r, g, b] = window.__c.rgb(s); return 0.2126 * window.__c.lin(r) + 0.7152 * window.__c.lin(g) + 0.0722 * window.__c.lin(b) },
  ratio(fg, bg) {
    const a = window.__c.lum(fg), b = window.__c.lum(bg)
    const [hi, lo] = a > b ? [a, b] : [b, a]
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
  },
}
true`

async function abreOnboarding() {
  await send('Page.navigate', { url: URL_ALVO })
  await sleep(2200)
  await ev(PROBES)
  // fatura → extrato → criar → onboarding
  for (let i = 0; i < 3; i++) {
    await ev('window.__o.trocaModulo()')
    await sleep(150)
  }
  await sleep(250)
  return ev('window.__o.modulo()')
}

// Os quatro estados do produto, nesta ordem de toggles (cada um parte do anterior).
async function matriz() {
  const leitura = async (nome) => {
    await sleep(250)
    const passos = await ev('window.__o.todos()')
    return {
      nome,
      cartao: await ev('window.__o.cartao()'),
      historico: await ev('window.__o.historico()'),
      solidosEmAmbar: await ev('window.__o.quantosSolidos()'),
      passos,
      contraste: await Promise.all(
        passos.map(async (p) => ({
          passo: p.glifo,
          marca: await ev(
            `window.__c.ratio(${JSON.stringify(p.glifoCor)}, ${JSON.stringify(p.glifoFundo)})`,
          ),
          titulo: await ev(
            `window.__c.ratio(${JSON.stringify(p.tituloCor)}, ${JSON.stringify(p.tituloFundo)})`,
          ),
          tituloPx: p.tituloPx,
        })),
      ),
    }
  }

  const out = {}
  out.nadaFeito = await leitura('sem cartão, sem histórico')
  await ev('window.__o.trocaCartao()')
  out.soCartao = await leitura('cartão cadastrado (passo 1 feito)')
  await ev('window.__o.trocaHistorico()')
  out.tudoFeito = await leitura('cartão + histórico')
  await ev('window.__o.trocaCartao()')
  out.soHistorico = await leitura('só histórico (extrato não exige cartão)')
  await ev('window.__o.trocaCartao()') // volta para o estado 11
  return out
}

async function destinos() {
  const clica = async (rotulo) => {
    const r = await ev(`window.__o.clica(${JSON.stringify(rotulo)})`)
    await sleep(250)
    return { clique: r, rota: await ev('window.__o.rota()'), analise: await ev('window.__o.analiseAberta()') }
  }
  return {
    inicial: { rota: await ev('window.__o.rota()'), analise: await ev('window.__o.analiseAberta()') },
    cartoes: await clica('Ir para Cartões'),
    fatura: await clica('Importar fatura'),
    manual: await clica('ou lance à mão'),
    analise: await clica('Abrir Análise'),
  }
}

const rel = { url: URL_ALVO, viewports: {} }

for (const nome of ['desktop', 'mobile']) {
  await viewport(nome)
  await abreOnboarding()
  if (nome === 'mobile') {
    // A prop `isMobile` acompanha a viewport emulada — as duas, nunca uma só.
    await ev('window.__o.trocaLayout()')
    await sleep(300)
  }

  const v = {
    larguraReal: await ev('window.__o.larguraReal()'),
    layout: await ev('window.__o.layout()'),
    matriz: await matriz(),
  }
  await shot(`onb-${nome}-tudo-feito.png`)

  // Estado inicial de novo (é o que o usuário novo vê) para foto e destinos.
  await abreOnboarding()
  if (nome === 'mobile') {
    await ev('window.__o.trocaLayout()')
    await sleep(300)
  }
  v.overflowDaPagina = await ev('window.__o.overflowDaPagina()')
  await shot(`onb-${nome}-inicial.png`)
  v.destinos = await destinos()

  // Dispensa: o efeito real (localStorage por usuário) e o caminho de leitura.
  v.dismiss = {
    chavesAntes: await ev('window.__o.chaves ? window.__o.chaves() : window.__onb.chaves()'),
    dispensadoAntes: await ev('window.__onb.dispensado()'),
    clique: await ev("window.__o.clica('Dispensar onboarding')"),
  }
  await sleep(250)
  v.dismiss.bannerDepois = await ev('window.__o.presente()')
  v.dismiss.dispensadoDepois = await ev('window.__onb.dispensado()')
  v.dismiss.chavesDepois = await ev('window.__onb.chaves()')
  // Remontar o componente (sair e voltar do módulo) exercita o CAMINHO DE
  // LEITURA da chave — o useState inicial roda de novo, sem recarregar a página.
  for (let i = 0; i < 4; i++) {
    await ev('window.__o.trocaModulo()')
    await sleep(150)
  }
  await sleep(250)
  v.dismiss.aposRemontar = await ev('window.__o.presente()')
  // E o que o "Começar do zero" faz: restaurar traz o guia de volta.
  await ev('window.__onb.restaurar()')
  for (let i = 0; i < 4; i++) {
    await ev('window.__o.trocaModulo()')
    await sleep(150)
  }
  await sleep(250)
  v.dismiss.aposRestaurar = await ev('window.__o.presente()')

  // A chave LEGADA (sem id) não pode dispensar a conta de ninguém.
  await ev("localStorage.setItem('hivvo_onboarding_dismissed', '1')")
  v.chaveLegada = {
    dispensado: await ev('window.__onb.dispensado()'),
    chavesDepois: await ev('window.__onb.chaves()'),
  }

  rel.viewports[nome] = v
}

rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio-onboarding.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
