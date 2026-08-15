// ─────────────────────────────────────────────────────────────────────────────
// Dirige o módulo `preferencia` do dev/harness.html num Edge headless e LÊ O DOM.
//
//   npm run dev                                              # em outro terminal
//   node dev/harness-cdp-preferencia.mjs [url] [pasta-saída]
//
// Arquivo separado dos outros drivers pelo mesmo motivo já anunciado no
// harness-cdp-onboarding.mjs: a metade de cima é transporte, igual nos quatro;
// o que muda são os PROBES.
//
// O QUE ESTE DRIVER PRECISA PROVAR, e nenhum teste puro alcança (o repo não tem
// jsdom nem @testing-library — ver PENDENCIAS):
//   1. o toggle nasce refletindo o SERVIDOR, não um default otimista — inclusive
//      no instante em que o usuário ainda não chegou (getMe em voo), quando ele
//      fica desabilitado em vez de mentir "ligado";
//   2. o clique vira o estado NA HORA (otimista), sem esperar o round-trip;
//   3. quando o salvamento FALHA, o toggle VOLTA. É a asserção que mais importa:
//      sem o rollback a tela diz "desligado" com o aviso ligado no servidor, e a
//      pessoa só descobre no próximo e-mail;
//   4. `role="switch"` + `aria-checked` acompanham o estado — é o que um leitor
//      de tela anuncia, e nada no visual denuncia se estiver errado;
//   5. nada disso quebra em 390px de largura REAL, e o alvo de toque continua
//      com pelo menos 44px de altura.
//
// Viewport EMULADA (Emulation.setDeviceMetricsOverride), nunca um container
// encolhido: a linha não tem prop de layout, ela responde à largura que sobra —
// medir dentro de uma janela de 1280px daria quebras que ninguém vê.
//
// Armadilhas herdadas: o Vite dev escuta em ::1 (use `localhost`), e dar ~250ms
// entre ação e leitura para o React re-renderizar. O salvamento do harness tem
// 150ms de latência de propósito, então a leitura do estado OTIMISTA acontece
// antes disso e a do desfecho, depois.
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

// ── Transporte ───────────────────────────────────────────────────────────────
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-pref-'))}`,
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

const VIEWPORTS = {
  desktop: { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true },
}
const viewport = (nome) => send('Emulation.setDeviceMetricsOverride', VIEWPORTS[nome])

await send('Page.enable')
await send('Runtime.enable')

// ── Probes ───────────────────────────────────────────────────────────────────
const PROBES = String.raw`
window.__p = {
  toggle() { return document.getElementById('toggle-aviso-vencimento') },
  // O ESTADO ACESSÍVEL, não a cor: é o que o leitor de tela anuncia, e é o
  // único lugar onde "ligado" está escrito de forma legível por máquina.
  estado() {
    const t = this.toggle()
    if (!t) return null
    return {
      role: t.getAttribute('role'),
      ariaChecked: t.getAttribute('aria-checked'),
      disabled: t.disabled,
      // Altura do alvo de toque, com o padding vertical incluído.
      alturaAlvo: Math.round(t.getBoundingClientRect().height),
      largura: Math.round(t.getBoundingClientRect().width),
    }
  },
  erro() { return document.body.dataset.prefErro ?? null },
  limparErro() { delete document.body.dataset.prefErro },
  // O texto explicativo não pode sumir nem transbordar no mobile.
  descricao() {
    const p = document.querySelector('#toggle-aviso-vencimento')
      ?.closest('div')?.querySelector('p')
    if (!p) return null
    const r = p.getBoundingClientRect()
    return { texto: p.textContent.trim().slice(0, 40), largura: Math.round(r.width) }
  },
  // Sangramento horizontal: a linha não pode empurrar a página.
  overflow() {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth
  },
  async clicar() {
    this.toggle().click()
  },
  botao(id) { return document.getElementById(id) },
}
`

async function irPara(modulo) {
  // O seletor de módulo é cíclico: clica até chegar.
  for (let i = 0; i < 8; i++) {
    const atual = await ev(`document.getElementById('harness-toggle-modulo').textContent`)
    if (atual.includes(modulo)) return
    await ev(`document.getElementById('harness-toggle-modulo').click()`)
    await sleep(120)
  }
  throw new Error(`não cheguei no módulo ${modulo}`)
}

async function setLayout(alvo) {
  for (let i = 0; i < 3; i++) {
    const atual = await ev(`document.getElementById('harness-toggle-mobile').textContent`)
    if (atual.includes(alvo)) return
    await ev(`document.getElementById('harness-toggle-mobile').click()`)
    await sleep(120)
  }
}

async function setServidor(alvo) {
  for (let i = 0; i < 4; i++) {
    const atual = await ev(`document.getElementById('harness-toggle-pref-servidor').textContent`)
    if (atual.includes(alvo)) return
    await ev(`document.getElementById('harness-toggle-pref-servidor').click()`)
    await sleep(120)
  }
  throw new Error(`não consegui pôr o servidor em ${alvo}`)
}

async function setFalha(deveFalhar) {
  const querido = deveFalhar ? 'FALHA' : 'sucesso'
  for (let i = 0; i < 3; i++) {
    const atual = await ev(`document.getElementById('harness-toggle-pref-falha').textContent`)
    if (atual.includes(querido)) return
    await ev(`document.getElementById('harness-toggle-pref-falha').click()`)
    await sleep(120)
  }
}

// ── Roteiro ──────────────────────────────────────────────────────────────────
await send('Page.navigate', { url: URL_ALVO })
await sleep(1800)
await ev(PROBES)
await irPara('preferencia')
await sleep(200)

const rel = { url: URL_ALVO, viewports: {} }

for (const nome of Object.keys(VIEWPORTS)) {
  await viewport(nome)
  await setLayout(nome === 'mobile' ? 'mobile' : 'desktop')
  await sleep(250)
  await ev(`window.__p.limparErro()`)

  const v = {}

  // (1) reflete o servidor: LIGADO
  await setServidor('servidor: true')
  await sleep(200)
  v.servidorLigado = await ev(`window.__p.estado()`)

  // (1b) reflete o servidor: DESLIGADO
  await setServidor('servidor: false')
  await sleep(200)
  v.servidorDesligado = await ev(`window.__p.estado()`)

  // (1c) usuário ainda não chegou → desabilitado, sem mentir "ligado"
  await setServidor('ainda não chegou')
  await sleep(200)
  v.semUsuario = await ev(`window.__p.estado()`)

  // (2) clique otimista — lido ANTES dos 150ms de latência do harness
  await setServidor('servidor: false')
  await setFalha(false)
  await sleep(200)
  await ev(`window.__p.clicar()`)
  await sleep(40)
  v.otimista = await ev(`window.__p.estado()`)
  await sleep(400)
  v.depoisDoSucesso = await ev(`window.__p.estado()`)
  v.erroAposSucesso = await ev(`window.__p.erro()`)

  // (3) falha → ROLLBACK visível + mensagem
  await setServidor('servidor: true')
  await setFalha(true)
  await sleep(200)
  const antesDaFalha = await ev(`window.__p.estado()`)
  await ev(`window.__p.clicar()`)
  await sleep(40)
  v.otimistaAntesDaFalha = await ev(`window.__p.estado()`)
  await sleep(500)
  v.depoisDaFalha = await ev(`window.__p.estado()`)
  v.erroDaFalha = await ev(`window.__p.erro()`)
  v.voltouAoOriginal = antesDaFalha.ariaChecked === v.depoisDaFalha.ariaChecked

  // (5) layout
  v.descricao = await ev(`window.__p.descricao()`)
  v.overflow = await ev(`window.__p.overflow()`)

  await setFalha(false)
  await setServidor('servidor: true')
  await sleep(250)
  await shot(`pref-${nome}.png`)

  rel.viewports[nome] = v
}

rel.errosDeConsole = erros
console.log(JSON.stringify(rel, null, 2))

// ── Veredito ─────────────────────────────────────────────────────────────────
const falhas = []
for (const [nome, v] of Object.entries(rel.viewports)) {
  const p = (msg) => falhas.push(`[${nome}] ${msg}`)
  if (v.servidorLigado.role !== 'switch') p('role não é switch')
  if (v.servidorLigado.ariaChecked !== 'true') p('servidor ligado não refletido')
  if (v.servidorDesligado.ariaChecked !== 'false') p('servidor desligado não refletido')
  if (!v.semUsuario.disabled) p('sem usuário o toggle deveria ficar desabilitado')
  if (v.semUsuario.ariaChecked !== 'false') p('sem usuário não pode anunciar ligado')
  if (v.otimista.ariaChecked !== 'true') p('clique não virou o estado na hora (otimista)')
  if (v.depoisDoSucesso.ariaChecked !== 'true') p('sucesso não manteve o estado')
  if (v.erroAposSucesso !== null) p('sucesso produziu mensagem de erro')
  if (v.otimistaAntesDaFalha.ariaChecked !== 'false') p('otimismo não aconteceu antes da falha')
  if (!v.voltouAoOriginal) p('ROLLBACK NÃO ACONTECEU — a tela mente sobre o servidor')
  if (!v.erroDaFalha) p('falha não avisou o usuário')
  if (v.overflow > 0) p(`sangramento horizontal de ${v.overflow}px`)
  if (v.alturaAlvo !== undefined && v.alturaAlvo < 44) p('alvo de toque menor que 44px')
}
const alvoMobile = rel.viewports.mobile.servidorLigado.alturaAlvo
if (alvoMobile < 44) falhas.push(`[mobile] alvo de toque de ${alvoMobile}px (< 44)`)
if (erros.length) falhas.push(`erros de console: ${erros.join(' | ')}`)

if (falhas.length) {
  console.error('\nFALHOU:\n' + falhas.map((f) => '  - ' + f).join('\n'))
  edge.kill()
  process.exit(1)
}
console.error('\nOK — toggle reflete o servidor, é otimista, faz rollback na falha, e cabe em 390px.')
edge.kill()
