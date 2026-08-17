// ─────────────────────────────────────────────────────────────────────────────
// Dirige o módulo `shell` do dev/harness.html num Edge headless e LÊ O DOM.
//
//   npm run dev                                        # em outro terminal
//   node dev/harness-cdp-shell.mjs [url] [pasta-saída]
//
// O QUE ESTE DRIVER MEDE, e por que ele existe separado dos outros: os demais
// verificam um COMPONENTE. Este verifica a CADEIA — a relação entre o componente
// e o shell acima dele. Foi essa camada que faltou quando um `label.sr-only` de
// uma linha (position:absolute, offsets auto) passou por lint, 43 testes, build,
// quatro drivers de harness e um E2E de cinco telas, e mesmo assim levou o
// scrollHeight do documento a 3284px num aparelho de 695px.
//
// A INVARIANTE, que vale para qualquer módulo e não só para este:
//
//   Nenhum elemento fora de fluxo pode ter o BLOCO INICIAL como continente.
//
// Quando tem, ele devolve o transbordo ao documento em vez de ao scroller do
// shell. O documento ganha altura rolável, o shell rola inteiro, e no iOS não
// volta ao fechar o teclado. A correção é o scroller estabelecer bloco continente
// (`relative` nos três <main>) — e este driver prova o antes E o depois, tirando
// o `relative` em runtime para ver o defeito voltar.
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
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'edge-shell-'))}`,
    '--no-first-run',
    '--disable-gpu',
    '--window-size=390,844',
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
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, nome), Buffer.from(data, 'base64'))
}

// Viewport de VERDADE — um iPhone de 390×844. `mobile: true` também muda o
// comportamento de layout, não só o número de pixels.
const viewport = () =>
  send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  })

await send('Page.enable')
await send('Runtime.enable')

// ── Probes ───────────────────────────────────────────────────────────────────
// Tudo lido da página viva. Nada é conferido contra o código-fonte.
const PROBES = String.raw`
window.__s = {
  // Sobe a árvore até o primeiro ancestral POSICIONADO. Quem não achar nenhum
  // tem o bloco inicial como continente — e é esse o defeito.
  continente(el) {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      // transform/filter/contain também criam bloco continente para absolute.
      const criaBloco =
        cs.position !== 'static' ||
        cs.transform !== 'none' ||
        cs.filter !== 'none' ||
        (cs.contain && /paint|layout|strict|content/.test(cs.contain))
      if (criaBloco) {
        return {
          seletor: window.__s.descreve(n),
          porque: cs.position !== 'static' ? 'position: ' + cs.position : 'transform/filter/contain',
        }
      }
    }
    return { seletor: 'BLOCO INICIAL (ICB / documento)', porque: 'nenhum ancestral posicionado' }
  },

  descreve(el) {
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    return (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '')).slice(0, 72)
  },

  // A INVARIANTE. Todo elemento fora de fluxo cujo continente é o bloco inicial.
  // 'fixed' fica de fora de propósito: o continente dele é o viewport POR
  // DEFINIÇÃO, e isso é o comportamento desejado (é o que faz um modal cobrir a
  // tela). O que nao pode e 'absolute' escapando.
  fugitivos() {
    const out = []
    for (const el of document.querySelectorAll('*')) {
      if (getComputedStyle(el).position !== 'absolute') continue
      const c = window.__s.continente(el)
      if (!c.seletor.startsWith('BLOCO INICIAL')) continue
      const r = el.getBoundingClientRect()
      out.push({
        elemento: window.__s.descreve(el),
        fundoNoDocumento: Math.round(r.bottom + window.scrollY),
        altura: Math.round(r.height),
      })
    }
    return out.sort((a, b) => b.fundoNoDocumento - a.fundoNoDocumento)
  },

  // O label que causou tudo — reportado à parte porque é o caso nomeado.
  label() {
    const el = document.querySelector('label.sr-only')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      texto: el.textContent.trim(),
      position: getComputedStyle(el).position,
      continente: window.__s.continente(el),
      fundoNoDocumento: Math.round(r.bottom + window.scrollY),
      // Continua acessível? O elo com o campo é o que a correção não pode quebrar.
      htmlFor: el.getAttribute('for'),
      campoExiste: !!document.getElementById(el.getAttribute('for') || ''),
      // 1px e recortado = invisível ao olho, presente ao leitor de tela.
      caixa: Math.round(r.width) + 'x' + Math.round(r.height),
    }
  },

  alturas() {
    const d = document.documentElement
    return {
      clientHeight: d.clientHeight,
      docScrollHeight: d.scrollHeight,
      bodyScrollHeight: document.body.scrollHeight,
      // O veredito, em uma palavra.
      transbordo: d.scrollHeight - d.clientHeight,
    }
  },

  // Os <main> da cadeia, para provar QUE o relative está lá (e para tirá-lo).
  scrollers() {
    return [...document.querySelectorAll('main')].map((m) => ({
      seletor: window.__s.descreve(m),
      position: getComputedStyle(m).position,
      scrollHeight: m.scrollHeight,
      clientHeight: m.clientHeight,
    }))
  },
  tiraRelative() {
    document.querySelectorAll('main').forEach((m) => m.classList.remove('relative'))
    return true
  },
  poeRelative() {
    document.querySelectorAll('main').forEach((m) => m.classList.add('relative'))
    return true
  },

  // ── Modal ────────────────────────────────────────────────────────────────
  // A pergunta: 'relative' no scroller PRENDE um 'fixed inset-0' renderizado
  // dentro dele? Se prendesse, a caixa do modal não bateria com o viewport.
  abreModal() {
    const b = document.getElementById('harness-abre-modal')
    if (!b) return 'botão não encontrado'
    b.click()
    return 'ok'
  },
  modal() {
    const el = document.querySelector('div.fixed.inset-0')
    if (!el) return { achou: false }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    // No centro da tela, quem responde ao clique é o modal ou algo atrás dele?
    const noTopo = document.elementFromPoint(innerWidth / 2, innerHeight / 2)
    return {
      achou: true,
      position: cs.position,
      zIndex: cs.zIndex,
      // Cobre o viewport inteiro? Se o relative tivesse capturado, não cobriria.
      caixa: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      viewport: { w: innerWidth, h: innerHeight },
      cobreViewport:
        Math.round(r.x) === 0 &&
        Math.round(r.y) === 0 &&
        Math.round(r.width) === innerWidth &&
        Math.round(r.height) === innerHeight,
      // O modal (ou seu conteúdo) está por cima de tudo no centro da tela?
      recebeCliqueNoCentro: !!(noTopo && (noTopo === el || el.contains(noTopo))),
      titulo: (el.querySelector('h2') || {}).textContent || null,
    }
  },
  fechaModal() {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === 'Fechar',
    )
    if (!b) return 'botão não encontrado'
    b.click()
    return 'ok'
  },

  modulo() { return document.getElementById('harness-toggle-modulo').textContent.trim() },
  trocaModulo() { document.getElementById('harness-toggle-modulo').click(); return true },
}
true`

// Dá a volta no carrossel de módulos até parar no `shell`. PERGUNTA em vez de
// contar — contar amarrou o driver de onboarding a um número de módulos que
// mudou, e duas verificações ficaram cegas por semanas.
async function abreShell() {
  for (let i = 0; i < 12; i++) {
    await ev('window.__s.trocaModulo()')
    await sleep(150)
    if ((await ev('window.__s.modulo()')).includes('shell')) {
      await sleep(400)
      return ev('window.__s.modulo()')
    }
  }
  throw new Error('não cheguei ao módulo shell — o carrossel mudou?')
}

async function leitura() {
  return {
    alturas: await ev('window.__s.alturas()'),
    fugitivos: await ev('window.__s.fugitivos()'),
    label: await ev('window.__s.label()'),
    scrollers: await ev('window.__s.scrollers()'),
  }
}

// ── Execução ─────────────────────────────────────────────────────────────────
await viewport()
await send('Page.navigate', { url: URL_ALVO })
await sleep(2200)
await ev(PROBES)
await abreShell()

const rel = { url: URL_ALVO, viewport: '390x844 mobile' }

// DEPOIS: como o código está agora, com `relative` nos três <main>.
rel.depoisDaCorrecao = await leitura()
await shot('shell-depois.png')

// ANTES: tira o `relative` em runtime. Se o defeito voltar, foi ele que curou.
await ev('window.__s.tiraRelative()')
await sleep(400)
rel.antes_semRelative = await leitura()
await shot('shell-antes.png')

// E volta, para não medir o modal num estado que não é o do código.
await ev('window.__s.poeRelative()')
await sleep(400)
rel.recolocado = await ev('window.__s.alturas()')

// ── Modais ───────────────────────────────────────────────────────────────────
// `relative` com z-index auto NÃO cria contexto de empilhamento, e `fixed` não é
// capturado por ancestral relative. Isso é raciocínio; abaixo está a medida.
rel.modal = { semModal: await ev('window.__s.modal()') }
rel.modal.clique = await ev('window.__s.abreModal()')
await sleep(350)
rel.modal.aberto = await ev('window.__s.modal()')
await shot('shell-modal.png')
rel.modal.fecha = await ev('window.__s.fechaModal()')
await sleep(350)
rel.modal.depoisDeFechar = await ev('window.__s.modal()')

// ── Veredito ─────────────────────────────────────────────────────────────────
const d = rel.depoisDaCorrecao
const a = rel.antes_semRelative
rel.veredito = {
  transbordoDepois: d.alturas.transbordo,
  transbordoAntes: a.alturas.transbordo,
  fugitivosDepois: d.fugitivos.length,
  fugitivosAntes: a.fugitivos.length,
  labelContinenteDepois: d.label && d.label.continente.seletor,
  labelContinenteAntes: a.label && a.label.continente.seletor,
  labelSegueLigadoAoCampo: !!(d.label && d.label.campoExiste),
  modalCobreViewport: rel.modal.aberto.cobreViewport,
  modalRecebeClique: rel.modal.aberto.recebeCliqueNoCentro,
  passou:
    d.alturas.transbordo === 0 &&
    d.fugitivos.length === 0 &&
    a.alturas.transbordo > 0 &&
    !!rel.modal.aberto.cobreViewport &&
    !!rel.modal.aberto.recebeCliqueNoCentro &&
    !!(d.label && d.label.campoExiste),
}

rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio-shell.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
