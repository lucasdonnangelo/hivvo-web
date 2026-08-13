// ─────────────────────────────────────────────────────────────────────────────
// Dirige o módulo `feedback` do dev/harness.html num Edge headless e LÊ O DOM.
//
//   npm run dev                                           # em outro terminal
//   node dev/harness-cdp-feedback.mjs [url] [pasta-saída]
//
// Arquivo separado dos outros drivers pelo mesmo motivo que o cabeçalho do
// harness-cdp-onboarding.mjs já anuncia: a metade de cima é transporte, igual
// nos três; o que muda são os PROBES. Extrair o transporte comum mexeria em dois
// drivers que funcionam para ganhar 60 linhas, no meio de outra tarefa.
//
// O QUE ESTE DRIVER PRECISA PROVAR, e nenhum teste puro alcança:
//   1. o botão NUNCA fica disabled em silêncio — com a caixa vazia ele segue
//      clicável, e o clique produz uma frase dizendo o que falta;
//   2. o texto digitado SOBREVIVE às duas falhas (502 e 429). Sem tabela do
//      outro lado, a caixa é a única cópia da mensagem;
//   3. a cópia do 429 DIFERE da do 502 — se as duas caíssem no mesmo fallback
//      genérico, o tratamento novo do extractDetail não estaria valendo;
//   4. nada disso quebra em 390px de largura REAL.
//
// Viewport EMULADA (Emulation.setDeviceMetricsOverride), nunca um container
// encolhido: o formulário não tem prop de layout, ele responde à largura que
// sobra — medir dentro de uma janela de 1280px daria quebras que ninguém vê.
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
const PORT = 9335
const EDGE =
  process.env.EDGE_BIN ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── Transporte ───────────────────────────────────────────────────────────────
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-fb-'))}`,
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
window.__f = {
  campo() { return document.getElementById('feedback-mensagem') },
  // O botão de envio é o único <button> dentro do invólucro do formulário.
  // Selecionado por posição e não por texto de propósito: durante o envio o
  // Button troca os children pelo spinner e o textContent fica vazio.
  botao() { const c = window.__f.campo(); return c ? c.parentElement.querySelector('button') : null },
  erroEl() { return document.getElementById('feedback-erro') },
  sucessoEl() { return document.querySelector('[data-feedback="enviado"]') },

  // Fundo EFETIVO (camadas translúcidas compostas de baixo para cima), igual ao
  // driver do onboarding — sem isso o contraste do erro daria número fantasia.
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
    if (camadas.length === 0 || camadas[camadas.length - 1][3] !== 1) camadas.push([255, 255, 255, 1])
    let [r, g, b] = camadas[camadas.length - 1]
    for (let i = camadas.length - 2; i >= 0; i--) {
      const [cr, cg, cb, ca] = camadas[i]
      r = cr * ca + r * (1 - ca); g = cg * ca + g * (1 - ca); b = cb * ca + b * (1 - ca)
    }
    return 'rgb(' + Math.round(r) + ', ' + Math.round(g) + ', ' + Math.round(b) + ')'
  },

  // Estado COMPLETO do formulário, do jeito que a tela o entrega.
  estado() {
    const campo = window.__f.campo()
    const botao = window.__f.botao()
    const erro = window.__f.erroEl()
    const sucesso = window.__f.sucessoEl()
    const ps = erro ? [...erro.querySelectorAll('p')] : []
    return {
      formularioPresente: !!campo,
      // O QUE O USUÁRIO DIGITOU, lido do campo vivo. É a asserção central das
      // duas falhas: se isto esvaziar, a mensagem se perdeu.
      textoNoCampo: campo ? campo.value : null,
      alturaCampo: campo ? Math.round(campo.getBoundingClientRect().height) : null,
      larguraCampo: campo ? Math.round(campo.getBoundingClientRect().width) : null,
      botaoPresente: !!botao,
      // Nunca pode ser true com a caixa vazia — é a restrição da casa.
      botaoDisabled: botao ? botao.disabled : null,
      botaoTexto: botao ? botao.textContent.trim() : null,
      erroTexto: ps[0] ? ps[0].textContent.trim() : null,
      erroCor: ps[0] ? getComputedStyle(ps[0]).color : null,
      erroFundo: ps[0] ? window.__f.fundo(ps[0]) : null,
      erroPx: ps[0] ? getComputedStyle(ps[0]).fontSize : null,
      // A segunda linha do bloco de erro: "O que você escreveu continua aqui."
      erroTranquiliza: ps[1] ? ps[1].textContent.trim() : null,
      // aria: quem usa leitor de tela precisa saber que o campo está inválido.
      ariaInvalid: campo ? campo.getAttribute('aria-invalid') : null,
      ariaDescribedby: campo ? campo.getAttribute('aria-describedby') : null,
      erroRole: erro ? erro.getAttribute('role') : null,
      sucessoTexto: sucesso ? sucesso.textContent.replace(/\s+/g, ' ').trim() : null,
      // O que chegou ao callback — prova que a mensagem viajou íntegra.
      entregueAoCallback: document.body.dataset.feedbackEnviado ?? null,
      // Contador: só deve existir perto do limite.
      contador: (() => {
        const c = window.__f.campo()
        if (!c) return null
        const p = [...c.parentElement.querySelectorAll('p')]
          .find((x) => /^\d+ \/ \d+$/.test(x.textContent.trim()))
        return p ? p.textContent.trim() : null
      })(),
    }
  },

  // O endereço precisa estar À VISTA como texto, não escondido atrás de um
  // rótulo clicável: no mobile o mailto: muitas vezes não abre nada, e um link
  // que não faz nada é pior que um endereço que dá para copiar.
  enderecoAVista() {
    const alvo = 'contato@hivvo.app'
    const visivel = [...document.querySelectorAll('a, p, span')]
      .filter((el) => el.textContent.includes(alvo))
    const link = [...document.querySelectorAll('a')].find((a) => a.href.startsWith('mailto:'))
    return {
      apareceComoTexto: visivel.length > 0,
      textoDoLink: link ? link.textContent.trim() : null,
      hrefDoLink: link ? link.getAttribute('href') : null,
    }
  },

  // Escreve no campo controlado do React: o setter nativo + evento 'input', que
  // é o caminho que o React escuta. Atribuir .value direto não dispara nada.
  digita(texto) {
    const campo = window.__f.campo()
    if (!campo) return 'campo não encontrado'
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  },
  envia() { const b = window.__f.botao(); if (!b) return 'botão não encontrado'; b.click(); return 'ok' },
  clicaEnviarOutra() {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Enviar outra'))
    if (!b) return 'não encontrado'
    b.click(); return 'ok'
  },

  overflowDaPagina() { return document.documentElement.scrollWidth - window.innerWidth },
  larguraReal() { return { innerWidth: window.innerWidth, dpr: devicePixelRatio } },

  modulo() { return document.getElementById('harness-toggle-modulo').textContent.trim() },
  trocaModulo() { document.getElementById('harness-toggle-modulo').click(); return true },
  layout() { return document.getElementById('harness-toggle-mobile').textContent.trim() },
  trocaLayout() { document.getElementById('harness-toggle-mobile').click(); return true },
  resultado() { return document.getElementById('harness-toggle-resultado').textContent.trim() },
  trocaResultado() { document.getElementById('harness-toggle-resultado').click(); return true },
}

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

async function abreFeedback() {
  await send('Page.navigate', { url: URL_ALVO })
  await sleep(2200)
  await ev(PROBES)
  // fatura → extrato → criar → onboarding → feedback
  for (let i = 0; i < 4; i++) {
    await ev('window.__f.trocaModulo()')
    await sleep(150)
  }
  await sleep(250)
  return ev('window.__f.modulo()')
}

const MENSAGEM = 'O gráfico de agosto fica girando pra sempre e nunca carrega.'

async function ler() {
  await sleep(300)
  return ev('window.__f.estado()')
}

// Põe o harness no desfecho pedido, seja qual for o atual.
async function usaResultado(alvo) {
  for (let i = 0; i < 3; i++) {
    if ((await ev('window.__f.resultado()')).includes(alvo)) return true
    await ev('window.__f.trocaResultado()')
    await sleep(150)
  }
  return false
}

async function roteiro() {
  const passos = {}

  // 1. Estado inicial: caixa vazia. O botão NÃO pode estar apagado.
  passos.inicial = await ler()

  // 2. Clique com a caixa vazia — tem de produzir a frase, não silêncio.
  await ev('window.__f.envia()')
  passos.cliqueVazio = await ler()

  // 3. Digitar limpa o erro (reatividade — a classe de bug que tsc não vê).
  await ev(`window.__f.digita(${JSON.stringify(MENSAGEM)})`)
  passos.aposDigitar = await ler()

  // 4. Falha 502: a cópia do backend, e o texto INTACTO.
  await usaResultado('falha-502')
  await ev('window.__f.envia()')
  await sleep(400)
  passos.falha502 = await ler()

  // 5. Limite 429: cópia DIFERENTE, texto ainda intacto.
  await usaResultado('limite-429')
  await ev('window.__f.envia()')
  await sleep(400)
  passos.limite429 = await ler()

  // 6. Sucesso: confirmação em pé, e a mensagem íntegra no callback.
  await usaResultado('sucesso')
  await ev('window.__f.envia()')
  await sleep(500)
  passos.sucesso = await ler()

  // 7. "Enviar outra" devolve o formulário limpo.
  await ev('window.__f.clicaEnviarOutra()')
  passos.enviarOutra = await ler()

  // 8. Contador: aparece só perto do limite, não o tempo todo.
  await ev(`window.__f.digita(${JSON.stringify('x'.repeat(3600))})`)
  passos.pertoDoLimite = await ler()
  await ev(`window.__f.digita(${JSON.stringify('curta')})`)
  passos.longeDoLimite = await ler()

  return passos
}

const rel = { url: URL_ALVO, viewports: {} }

for (const nome of ['desktop', 'mobile']) {
  await viewport(nome)
  await abreFeedback()
  if (nome === 'mobile') {
    // O invólucro de largura acompanha a viewport emulada — os dois, nunca um só.
    await ev('window.__f.trocaLayout()')
    await sleep(300)
  }

  const v = {
    larguraReal: await ev('window.__f.larguraReal()'),
    layout: await ev('window.__f.layout()'),
    enderecoAVista: await ev('window.__f.enderecoAVista()'),
  }
  await shot(`fb-${nome}-inicial.png`)

  v.passos = await roteiro()
  v.overflowDaPagina = await ev('window.__f.overflowDaPagina()')

  // Contraste do texto de erro sobre o fundo efetivo. É texto de 12px → o piso
  // é 4,5:1 (AA para texto normal), não 3:1.
  const e = v.passos.limite429
  v.contrasteDoErro = {
    px: e.erroPx,
    ratio: await ev(
      `window.__c.ratio(${JSON.stringify(e.erroCor)}, ${JSON.stringify(e.erroFundo)})`,
    ),
  }

  // Foto do estado de erro (é o que precisa ser legível sob pressão).
  await usaResultado('limite-429')
  await ev(`window.__f.digita(${JSON.stringify(MENSAGEM)})`)
  await ev('window.__f.envia()')
  await sleep(500)
  await shot(`fb-${nome}-erro.png`)

  rel.viewports[nome] = v
}

// Comparações que o relatório precisa responder sem ninguém ler JSON à mão.
rel.veredito = Object.fromEntries(
  Object.entries(rel.viewports).map(([nome, v]) => [
    nome,
    {
      botaoNuncaDisabledComCaixaVazia:
        v.passos.inicial.botaoDisabled === false && v.passos.cliqueVazio.botaoDisabled === false,
      cliqueVazioProduzFrase: v.passos.cliqueVazio.erroTexto,
      textoSobreviveAo502: v.passos.falha502.textoNoCampo === MENSAGEM,
      textoSobreviveAo429: v.passos.limite429.textoNoCampo === MENSAGEM,
      copiaDo429DifereDoDo502:
        v.passos.limite429.erroTexto !== v.passos.falha502.erroTexto,
      mensagemChegouIntegraAoCallback: v.passos.sucesso.entregueAoCallback === MENSAGEM,
      contadorSoPertoDoLimite:
        v.passos.longeDoLimite.contador === null && v.passos.pertoDoLimite.contador !== null,
      semOverflowHorizontal: v.overflowDaPagina <= 0,
    },
  ]),
)

rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio-feedback.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
