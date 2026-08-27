// ─────────────────────────────────────────────────────────────────────────────
// Probe DEDICADO ao seletor de cartão no DÉBITO (#71). Transporte GENÉRICO
// copiado de dev/harness-cdp.mjs (ver o cabeçalho de lá) — só os probes abaixo
// são novos.
//
//   npm run dev                                        # em outro terminal
//   node dev/harness-cdp-debito.mjs [url] [pasta-saída]
//
// Verifica, nos DOIS viewports (1256 e 390, via Emulation.setDeviceMetricsOverride
// — o AddTransactionPage lê `useBreakpoint('md')`, que é MEDIA QUERY: o botão
// "layout" do harness não vale aqui, só a viewport emulada):
//   (a) escolher "Débito" mostra o seletor de cartão (antes ele só existia no
//       crédito: showCartao era `isCredito && !recorrente`);
//   (b) a lista do débito traz o cartão de DÉBITO e o "Ambos", e NÃO traz o
//       cartão só-crédito — a semente tem os três de propósito;
//   (c) "Crédito" continua exatamente como antes: mesma lista de dois cartões,
//       mesma obrigatoriedade, parcelamento ainda aparece ao escolher cartão;
//   (d) nenhuma decisão de layout quebrou — retângulos por getBoundingClientRect,
//       não olhômetro: nada transborda a largura, nada colide na vertical, e a
//       linha de pílulas da forma de pagamento não quebra de forma nova.
//
// Verifica também a travessia 'Ambos': trocar Crédito→Débito com o Itaú
// (tipo "Ambos") escolhido PRESERVA a escolha, enquanto o Nubank (só crédito)
// é limpo — é o efeito que substituiu o `setValue('cartao_id', null)`
// incondicional de quando o cartão era exclusivo do crédito.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL_ALVO = process.argv[2] ?? 'http://localhost:5173/dev/harness.html'
const OUT = process.argv[3] ?? '.'
const PORT = 9337
const EDGE =
  process.env.EDGE_BIN ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Transporte (genérico, ver dev/harness-cdp.mjs) ──────────────────────────
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-harness-debito-'))}`,
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

// ── Probes ───────────────────────────────────────────────────────────────────
// Os campos do formulário são localizados pelo TEXTO DO RÓTULO e não por
// data-testid: o alvo é o DOM que o usuário recebe, e um testid teria de ser
// adicionado ao componente só para o harness enxergar — mudar a produção para
// medir a produção.
const PROBES = String.raw`
window.__d71 = {
  // O bloco (label + controle) cujo <label> tem exatamente este texto.
  bloco(rotulo) {
    const lab = [...document.querySelectorAll('label')]
      .find(l => l.textContent.trim() === rotulo)
    return lab ? lab.parentElement : null
  },
  rect(el) {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1),
             w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             bottom: +r.bottom.toFixed(1), right: +r.right.toFixed(1) }
  },
  // Pílulas da forma de pagamento: rótulo, se está ativa, e retângulo.
  formas() {
    const b = window.__d71.bloco('Forma de pagamento')
    if (!b) return null
    return [...b.querySelectorAll('button')].map(x => ({
      texto: x.textContent.trim(),
      ativa: x.className.includes('bg-amber'),
      rect: window.__d71.rect(x),
    }))
  },
  escolherForma(nome) {
    const b = window.__d71.bloco('Forma de pagamento')
    if (!b) return 'sem bloco'
    const alvo = [...b.querySelectorAll('button')].find(x => x.textContent.trim() === nome)
    if (!alvo) return 'forma ausente: ' + nome
    alvo.click()
    return 'ok'
  },
  // (a) e (b): o seletor existe? o que ele lista?
  cartao() {
    const b = window.__d71.bloco('Cartão')
    if (!b) return { visivel: false }
    const sel = b.querySelector('select')
    const aviso = b.querySelector('p')
    return {
      visivel: true,
      temSelect: !!sel,
      valor: sel ? sel.value : null,
      opcoes: sel ? [...sel.options].map(o => o.textContent.trim()) : null,
      textoAuxiliar: aviso ? aviso.textContent.trim().replace(/\s+/g, ' ') : null,
      rect: window.__d71.rect(b),
    }
  },
  escolherCartao(nomeParcial) {
    const b = window.__d71.bloco('Cartão')
    const sel = b ? b.querySelector('select') : null
    if (!sel) return 'sem select'
    const op = [...sel.options].find(o => o.textContent.includes(nomeParcial))
    if (!op) return 'cartao ausente: ' + nomeParcial
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')
      .set.call(sel, op.value)
    sel.dispatchEvent(new Event('input', { bubbles: true }))
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return 'ok'
  },
  // (c): o parcelamento é do crédito — some fora dele.
  parcelamentoVisivel() {
    return [...document.querySelectorAll('span')]
      .some(e => e.textContent.trim() === 'Parcelar compra')
  },
  // (d): a medida. Todos os blocos do formulário, na ordem do documento.
  layout() {
    // O formulário NAO e' um <form> — e' o div formFields. Ancoro nele pelo
    // bloco da forma de pagamento (que sempre existe) em vez de por classe,
    // que mudaria com qualquer ajuste de Tailwind.
    const cont = (window.__d71.bloco('Forma de pagamento') || {}).parentElement || null
    const larguraForm = cont ? +cont.getBoundingClientRect().width.toFixed(1) : null
    const direitaForm = cont ? +cont.getBoundingClientRect().right.toFixed(1) : null
    const blocos = [...(cont ? cont.querySelectorAll(':scope > div > label, :scope > div label') : [])]
      .map(l => ({
        rotulo: l.textContent.trim(),
        rect: window.__d71.rect(l.parentElement),
      }))
      .filter(b => b.rect && b.rect.h > 0)
    // Transbordo horizontal: qualquer bloco mais largo que o formulário.
    const transbordam = blocos.filter(b => b.rect.right > (direitaForm ?? 1e9) + 1.5)
    // Colisão vertical: um bloco começando acima do fim do anterior.
    const colidem = []
    for (let i = 1; i < blocos.length; i++) {
      if (blocos[i].rect.y < blocos[i - 1].rect.bottom - 1.5) {
        colidem.push([blocos[i - 1].rotulo, blocos[i].rotulo])
      }
    }
    return {
      larguraForm,
      scrollHorizontalDoDocumento:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      blocos,
      transbordam,
      colidem,
    }
  },
  // A linha de pílulas quebrou em quantas linhas? (mede por y distintos)
  linhasDasPilulas() {
    const f = window.__d71.formas() ?? []
    return [...new Set(f.map(p => p.rect.y))].length
  },
}
true`

async function carrega() {
  await send('Page.navigate', { url: URL_ALVO })
  await sleep(2500)
  // O harness começa no módulo 'fatura'; 'criar' é o terceiro do ciclo.
  await evaluate('document.getElementById("harness-toggle-modulo").click()')
  await sleep(200)
  await evaluate('document.getElementById("harness-toggle-modulo").click()')
  await sleep(600)
  await evaluate(PROBES)
}

async function setViewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  })
  await sleep(200)
}

async function rodada(rotulo) {
  const r = {}
  r.modulo = await evaluate('document.getElementById("harness-toggle-modulo").textContent.trim()')

  // Estado inicial (default PIX): sem seletor de cartão.
  r.formasOferecidas = (await evaluate('window.__d71.formas()'))?.map((f) => f.texto)
  r.cartaoNoPIX = await evaluate('window.__d71.cartao()')
  r.layoutPIX = await evaluate('window.__d71.layout()')

  // ── (a) e (b) DÉBITO ──────────────────────────────────────────────────────
  await evaluate('window.__d71.escolherForma("Débito")')
  await sleep(350)
  r.cartaoNoDebito = await evaluate('window.__d71.cartao()')
  r.parcelamentoNoDebito = await evaluate('window.__d71.parcelamentoVisivel()')
  r.linhasPilulasDebito = await evaluate('window.__d71.linhasDasPilulas()')
  r.layoutDebito = await evaluate('window.__d71.layout()')
  await shot(`debito-${rotulo}-debito.png`)

  // ── (c) CRÉDITO — igual a antes ───────────────────────────────────────────
  await evaluate('window.__d71.escolherForma("Crédito")')
  await sleep(350)
  r.cartaoNoCredito = await evaluate('window.__d71.cartao()')
  r.parcelamentoNoCreditoSemCartao = await evaluate('window.__d71.parcelamentoVisivel()')
  r.escolheNubank = await evaluate('window.__d71.escolherCartao("Nubank")')
  await sleep(350)
  r.parcelamentoNoCreditoComCartao = await evaluate('window.__d71.parcelamentoVisivel()')
  r.layoutCredito = await evaluate('window.__d71.layout()')
  await shot(`debito-${rotulo}-credito.png`)

  // ── Travessia: cartão só-crédito NÃO sobrevive ao débito ──────────────────
  await evaluate('window.__d71.escolherForma("Débito")')
  await sleep(350)
  r.aposCreditoNubankParaDebito = await evaluate('window.__d71.cartao()')

  // ── Travessia: cartão 'Ambos' SOBREVIVE ───────────────────────────────────
  await evaluate('window.__d71.escolherForma("Crédito")')
  await sleep(300)
  await evaluate('window.__d71.escolherCartao("Itaú")')
  await sleep(300)
  r.itauEscolhidoNoCredito = await evaluate('window.__d71.cartao()')
  await evaluate('window.__d71.escolherForma("Débito")')
  await sleep(350)
  r.aposCreditoItauParaDebito = await evaluate('window.__d71.cartao()')

  return r
}

const rel = { url: URL_ALVO }

await carrega()
await setViewport(1256, 900, false)
await sleep(300)
rel.desktop_1256 = await rodada('desktop')

await carrega()
await setViewport(390, 844, true)
await sleep(300)
rel.mobile_390 = await rodada('mobile')

rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio-debito.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
