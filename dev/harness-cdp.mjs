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

// ── Probes da MARCA DE DATA SUSPEITA (⚑) ────────────────────────────────────
// Tudo aqui é lido da página viva. As asserções não olham o código-fonte: se a
// marca não renderizar, ou renderizar na linha errada, ou colidir com o ◇, é o
// DOM que vai dizer.
window.__d = {
  // Fundo EFETIVO de um elemento: sobe até achar um background-color opaco.
  // Sem isto o contraste seria medido contra 'rgba(0,0,0,0)' e daria número
  // fantasia — a marca vive dentro de card sobre card.
  fundo(el) {
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c
    }
    return getComputedStyle(document.body).backgroundColor
  },
  // O container MAIS APERTADO que contém a descrição — <tr> no desktop, card no
  // mobile. Pegar o mais curto evita subir para a seção inteira.
  linha(desc) {
    return [...document.querySelectorAll('tr, div.rounded-md')]
      .filter(e => e.textContent.includes(desc))
      .sort((a, b) => a.textContent.length - b.textContent.length)[0] ?? null
  },
  rect(el) {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  },
  // Estado COMPLETO da marca numa linha: existe? onde? que cor? sobrepõe o ◇?
  marca(desc) {
    const linha = window.__d.linha(desc)
    if (!linha) return { achou: false }
    // A marca na DATA é um <span class=text-suspect> cujo texto começa com ISO.
    const naData = [...linha.querySelectorAll('span.text-suspect')]
      .find(s => /^\d{4}-\d{2}-\d{2}/.test(s.textContent.trim())) ?? null
    // O aviso é o <p class=text-suspect>.
    const aviso = linha.querySelector('p.text-suspect')
    const sugestao = linha.querySelector('span.text-suggest')
    const glifoNaData = naData
      ? [...naData.querySelectorAll('span')].find(s => s.textContent.trim() === '⚑') ?? null
      : null
    // Controle da linha que o leitor de tela encontra em modo de foco.
    const controle =
      linha.querySelector('input[type=checkbox][aria-label]') ??
      linha.querySelector('select[aria-label]')
    // (c) colisão: os retângulos do ⚑ e do ◇ se INTERSECTAM?
    let colide = null
    if (aviso && sugestao) {
      const a = aviso.getBoundingClientRect(), b = sugestao.getBoundingClientRect()
      colide = !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
    }
    return {
      achou: true,
      marcaNaData: !!naData,
      dataTexto: naData ? naData.textContent.trim() : null,
      glifoNaData: !!glifoNaData,
      glifoAriaHidden: glifoNaData ? glifoNaData.getAttribute('aria-hidden') : null,
      glifoLargura: glifoNaData ? glifoNaData.getBoundingClientRect().width : null,
      corData: naData ? getComputedStyle(naData).color : null,
      avisoPresente: !!aviso,
      avisoTexto: aviso ? aviso.textContent.trim() : null,
      avisoCor: aviso ? getComputedStyle(aviso).color : null,
      avisoFontSize: aviso ? getComputedStyle(aviso).fontSize : null,
      avisoFundo: aviso ? window.__d.fundo(aviso) : null,
      sugestaoPresente: !!sugestao,
      sugestaoTexto: sugestao ? sugestao.textContent.trim() : null,
      sugestaoCor: sugestao ? getComputedStyle(sugestao).color : null,
      colideComSugestao: colide,
      rects: aviso && sugestao
        ? { aviso: window.__d.rect(aviso), sugestao: window.__d.rect(sugestao) }
        : null,
      // (d) o aviso chega a quem não vê o glifo
      controleTag: controle ? controle.tagName.toLowerCase() : null,
      controleAria: controle ? controle.getAttribute('aria-label') : null,
      // (f) a linha flagada NÃO foi desmarcada nem removida por conta da marca
      checkbox: linha.querySelector('input[type=checkbox]')
        ? linha.querySelector('input[type=checkbox]').checked
        : null,
      temSelect: !!linha.querySelector('select'),
      textoRemovida: /removida|Restaurar/.test(linha.textContent),
    }
  },
  // Tofu: compara a largura do ⚑ com a de um codepoint de uso privado, que
  // NENHUMA fonte cobre. Larguras iguais = os dois caem na mesma caixa vazia.
  glifoRenderiza() {
    const mk = (txt) => {
      const s = document.createElement('span')
      s.textContent = txt
      s.style.cssText = 'position:absolute;visibility:hidden;font-size:11px;white-space:pre'
      document.body.appendChild(s)
      const w = s.getBoundingClientRect().width
      s.remove()
      return w
    }
    const bandeira = mk('⚑'), tofu = mk(''), diamante = mk('◇')
    return { bandeira, tofu, diamante, ok: bandeira > 0 && Math.abs(bandeira - tofu) > 0.5 }
  },
  moduloAtual() { return document.getElementById('harness-toggle-modulo').textContent.trim() },
  trocaModulo() { document.getElementById('harness-toggle-modulo').click(); return true },
  periodoBotao() {
    const b = document.getElementById('harness-toggle-periodo')
    return b ? b.textContent.trim() : null
  },
  trocaPeriodo() { document.getElementById('harness-toggle-periodo').click(); return true },
  // Quantas marcas existem na tela inteira — para (a) e (e) em uma leitura só.
  totais() {
    return {
      marcasNaData: [...document.querySelectorAll('span.text-suspect')]
        .filter(s => /^\d{4}-\d{2}-\d{2}/.test(s.textContent.trim())).length,
      avisos: document.querySelectorAll('p.text-suspect').length,
      sugestoes: document.querySelectorAll('span.text-suggest').length,
      avisoNaoReverificadas: (() => {
        const p = [...document.querySelectorAll('p')]
          .find(x => x.textContent.includes('não foram reverificadas'))
        return p ? p.textContent.trim() : null
      })(),
    }
  },
  // Edita o período do jeito que o React enxerga (setter do PROTÓTIPO).
  editaPeriodo(rotulo, valor) {
    const inp = [...document.querySelectorAll('input[type=date]')]
      .find(i => (i.getAttribute('aria-label') ?? '').includes(rotulo))
    if (!inp) return 'input não encontrado'
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, valor)
    inp.dispatchEvent(new Event('input', { bubbles: true }))
    inp.dispatchEvent(new Event('change', { bubbles: true }))
    return inp.value
  },
  // (f) no extrato: o estado de importar de todas as linhas, por descrição.
  marcadas() {
    return [...document.querySelectorAll('input[type=checkbox][aria-label]')]
      .map(c => ({ aria: c.getAttribute('aria-label'), checked: c.checked }))
  },
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

// ── MARCA DE DATA SUSPEITA (⚑) ───────────────────────────────────────────────
// As seis verificações exigidas, nos DOIS layouts. `isMobile` vem de
// useBreakpoint (prop), não de media query: inspecionar CSS não pegaria a
// divergência entre linhaMobile e linhaDesktop — só montar os dois pega.
const FAT = {
  flagadaComSugestao: 'MERCADO DIA',   // ⚑ E ◇ na mesma linha → teste (c)
  semFlag: 'UBER TRIP',                // controle: não pode ter marca
  flagadaCatDesativada: 'SMART FIT',   // ⚑ + sugestão fora das opções
  estornoFlagado: 'ESTORNO COMPRA',    // importado, read-only, sem conserto
}
const EXT = {
  antes: 'MERCADO BOM PRECO',          // antes_do_periodo
  depois: 'FARMACIA CENTRAL',          // depois_do_periodo  → cópia tem de diferir
  semFlag: 'POSTO IPIRANGA',           // controle
  pagamento: 'PAGTO FATURA CARTAO',    // card de pagamento (outro JSX)
  comRecorrencia: 'ADIANTAMENTO',      // ⚑ e ⚠ âmbar na mesma linha
}

const marcas = async (mapa) => {
  const out = {}
  for (const [k, d] of Object.entries(mapa)) out[k] = await ev(`window.__d.marca(${JSON.stringify(d)})`)
  return out
}

const ds = { fatura: {}, extrato: {} }

await carrega()
ds.glifo = await ev('window.__d.glifoRenderiza()')
ds.fatura.desktop = { ...(await marcas(FAT)), totais: await ev('window.__d.totais()') }
await shot('data-fatura-desktop.png')
await ev('window.__h.toggle()')
await sleep(400)
ds.fatura.mobile = { ...(await marcas(FAT)), totais: await ev('window.__d.totais()') }
await shot('data-fatura-mobile.png')

// (c) a marca tem de sobreviver ao usuário ESCOLHER categoria: o ◇ some (a
// escolha deixou de ser proposta), o ⚑ FICA (a data continua suspeita, e não há
// nada nesta tela com que decidir sobre ela).
await carrega()
ds.fatura.aposEscolherCategoria = {
  antes: await ev(`window.__d.marca(${JSON.stringify(FAT.flagadaComSugestao)})`),
  pick: await ev(`window.__h.pick(${JSON.stringify(FAT.flagadaComSugestao)}, "Lazer")`),
}
await sleep(300)
ds.fatura.aposEscolherCategoria.depois = await ev(`window.__d.marca(${JSON.stringify(FAT.flagadaComSugestao)})`)

// ── Extrato ──
await carrega()
await ev('window.__d.trocaModulo()')
await sleep(400)
ds.extrato.modulo = await ev('window.__d.moduloAtual()')
ds.extrato.desktop = { ...(await marcas(EXT)), totais: await ev('window.__d.totais()') }
ds.extrato.marcadasAntes = await ev('window.__d.marcadas()')
await shot('data-extrato-desktop.png')

// Com o período do documento PRESENTE a cópia cita a faixa (e o editor some).
await ev('window.__d.trocaPeriodo()')
await sleep(400)
ds.extrato.comPeriodoDoDocumento = {
  botao: await ev('window.__d.periodoBotao()'),
  antes: await ev(`window.__d.marca(${JSON.stringify(EXT.antes)})`),
  depois: await ev(`window.__d.marca(${JSON.stringify(EXT.depois)})`),
  inputsDeData: await ev('document.querySelectorAll("input[type=date]").length'),
}

// (e) editar o PERÍODO limpa os flags e acende o aviso de não-reverificação.
await carrega()
await ev('window.__d.trocaModulo()')
await sleep(400)
ds.extrato.edicaoPeriodo = {
  antes: await ev('window.__d.totais()'),
  inputsDeData: await ev('document.querySelectorAll("input[type=date]").length'),
  set: await ev('window.__d.editaPeriodo("Início do período", "2026-07-01")'),
}
await sleep(350)
ds.extrato.edicaoPeriodo.depois = await ev('window.__d.totais()')
ds.extrato.edicaoPeriodo.linhaAntesDepois = await ev(`window.__d.marca(${JSON.stringify(EXT.antes)})`)
// (f) limpar flag não pode ter mexido em NENHUMA decisão de importar.
ds.extrato.edicaoPeriodo.marcadasDepois = await ev('window.__d.marcadas()')
await shot('data-extrato-periodo-editado.png')

// Mobile do extrato: JSX duplicado, mesma bateria.
await carrega()
await ev('window.__d.trocaModulo()')
await sleep(300)
await ev('window.__h.toggle()')
await sleep(400)
ds.extrato.mobile = { ...(await marcas(EXT)), totais: await ev('window.__d.totais()') }
ds.extrato.marcadasMobile = await ev('window.__d.marcadas()')
await shot('data-extrato-mobile.png')

rel.dataSuspeita = ds
rel.errosConsole = erros
writeFileSync(join(OUT, 'relatorio.json'), JSON.stringify(rel, null, 2))
console.log(JSON.stringify(rel, null, 2))
ws.close()
edge.kill()
process.exit(0)
