import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Button from '../../components/ui/Button'
import { createTransaction, type TransactionCreatePayload } from '../../services/transactions'

const TEMPLATE_CSV = [
  'tipo,valor,descricao,categoria,data,forma_pagamento',
  'despesa,150.00,Supermercado Extra,Alimentação,2026-05-01,dinheiro',
  'receita,3000.00,Salário,Renda,2026-05-05,pix',
].join('\n')

const VALID_TIPOS = ['receita', 'despesa'] as const
const VALID_FORMAS = ['dinheiro', 'debito', 'credito', 'pix'] as const

interface ParsedRow {
  index: number
  tipo: string
  valor: string
  descricao: string
  categoria: string
  data: string
  forma_pagamento: string
  errors: string[]
  status: 'pending' | 'success' | 'error'
}

type Step = 'upload' | 'preview' | 'importing'

function parseCSV(text: string): ParsedRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim())
  if (lines.length < 2) return []

  return lines.slice(1).map((line, i) => {
    const cols = line.split(',')
    const [
      tipo = '',
      valor = '',
      descricao = '',
      categoria = '',
      data = '',
      forma_pagamento = '',
    ] = cols

    const errors: string[] = []

    if (!VALID_TIPOS.includes(tipo.trim() as (typeof VALID_TIPOS)[number])) {
      errors.push(`tipo inválido ("${tipo.trim()}")`)
    }
    const valorNum = parseFloat(valor.trim())
    if (isNaN(valorNum) || valorNum <= 0) {
      errors.push('valor inválido')
    }
    if (!descricao.trim()) errors.push('descrição obrigatória')
    if (!categoria.trim()) errors.push('categoria obrigatória')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.trim())) {
      errors.push('data deve ser YYYY-MM-DD')
    }
    if (!VALID_FORMAS.includes(forma_pagamento.trim() as (typeof VALID_FORMAS)[number])) {
      errors.push('forma de pagamento inválida')
    }

    return {
      index: i + 2,
      tipo: tipo.trim(),
      valor: valor.trim(),
      descricao: descricao.trim(),
      categoria: categoria.trim(),
      data: data.trim(),
      forma_pagamento: forma_pagamento.trim(),
      errors,
      status: 'pending' as const,
    }
  })
}

export default function ImportPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [isDragging, setIsDragging] = useState(false)

  const validRows = rows.filter((r) => r.errors.length === 0)
  const invalidCount = rows.length - validRows.length

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setRows(parseCSV(text))
      setStep('preview')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'beefree_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const toImport = validRows
    setStep('importing')
    setProgress({ done: 0, total: toImport.length })

    const updatedRows = [...rows]
    let done = 0

    for (const row of toImport) {
      const payload: TransactionCreatePayload = {
        tipo: row.tipo as 'receita' | 'despesa',
        valor: parseFloat(row.valor).toFixed(2),
        descricao: row.descricao,
        categoria: row.categoria,
        data: row.data,
        forma_pagamento: row.forma_pagamento,
        cartao_id: null,
        parcelado: false,
      }

      const rowIdx = updatedRows.findIndex((r) => r.index === row.index)
      try {
        await createTransaction(payload)
        updatedRows[rowIdx] = { ...updatedRows[rowIdx], status: 'success' }
      } catch {
        updatedRows[rowIdx] = { ...updatedRows[rowIdx], status: 'error' }
      }

      done++
      setProgress({ done, total: toImport.length })
      setRows([...updatedRows])
    }

    setTimeout(() => navigate('/transactions'), 800)
  }

  function goBack() {
    if (step === 'importing') return
    if (step === 'upload') navigate(-1)
    else {
      setStep('upload')
      setRows([])
      setFileName('')
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  const UploadStep = (
    <div className="flex flex-col gap-4">
      <button
        onClick={downloadTemplate}
        className="self-start text-xs text-amber hover:text-amber-light transition-colors underline underline-offset-2"
      >
        ↓ Baixar template CSV
      </button>

      <div
        role="button"
        tabIndex={0}
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer ${
          isDragging
            ? 'border-amber bg-amber/5'
            : 'border-bg-border hover:border-amber/50 hover:bg-amber/5'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
      >
        <span className="text-3xl text-text-muted select-none">↑</span>
        <p className="text-sm text-text-primary text-center">
          Arraste um arquivo <span className="text-amber">.csv</span> ou clique para selecionar
        </p>
        <p className="text-xs text-text-muted">Apenas arquivos .csv</p>
      </div>

      <p className="text-xs text-text-muted text-center">
        Atenção: campos de texto não devem conter vírgulas.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )

  // ── Preview ───────────────────────────────────────────────────────────────

  const PreviewStep = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted truncate">{fileName}</p>
        <div className="flex gap-3 text-xs shrink-0">
          <span className="text-success">{validRows.length} válidas</span>
          {invalidCount > 0 && <span className="text-danger">{invalidCount} com erro</span>}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          Nenhuma transação detectada no arquivo.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            const hasError = row.errors.length > 0
            return (
              <div
                key={row.index}
                className={`rounded-md border p-3 text-xs ${
                  hasError
                    ? 'border-danger/40 bg-danger/5'
                    : 'border-bg-border bg-bg-surface'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-medium ${
                          row.tipo === 'receita' ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {row.tipo || '—'}
                      </span>
                      <span className="text-text-primary truncate">
                        {row.descricao || '—'}
                      </span>
                      <span className="text-text-muted">{row.categoria || '—'}</span>
                    </div>
                    <div className="flex gap-3 text-text-muted">
                      <span>{row.data || '—'}</span>
                      <span>{row.forma_pagamento || '—'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span
                      className={`font-medium ${
                        row.tipo === 'receita' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {row.valor && !isNaN(parseFloat(row.valor))
                        ? `R$ ${parseFloat(row.valor).toFixed(2)}`
                        : '—'}
                    </span>
                    {hasError ? (
                      <span className="text-danger">✕</span>
                    ) : (
                      <span className="text-success">✓</span>
                    )}
                  </div>
                </div>
                {hasError && (
                  <p className="mt-1.5 text-danger text-[11px] leading-relaxed">
                    {row.errors.join(' · ')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── Importing ─────────────────────────────────────────────────────────────

  const pct =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const ImportingStep = (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Importando transações…</span>
          <span>
            {progress.done} / {progress.total}
          </span>
        </div>
        <div className="h-2 rounded-full bg-bg-border overflow-hidden">
          <div
            className="h-full bg-amber transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {rows
          .filter((r) => r.errors.length === 0)
          .map((row) => (
            <div
              key={row.index}
              className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-bg-surface border border-bg-border"
            >
              <span className="text-text-primary truncate">{row.descricao}</span>
              <span
                className={
                  row.status === 'success'
                    ? 'text-success'
                    : row.status === 'error'
                      ? 'text-danger'
                      : 'text-text-muted'
                }
              >
                {row.status === 'success' ? '✓' : row.status === 'error' ? '✕' : '…'}
              </span>
            </div>
          ))}
      </div>
    </div>
  )

  const stepContent =
    step === 'upload' ? UploadStep : step === 'preview' ? PreviewStep : ImportingStep

  // ── Mobile ────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-bg-border bg-bg-surface">
          <button
            onClick={goBack}
            disabled={step === 'importing'}
            className="text-text-muted hover:text-text-primary text-lg leading-none disabled:opacity-40 transition-colors"
            aria-label="Voltar"
          >
            ←
          </button>
          <h1 className="text-sm font-medium text-text-primary">Importar CSV</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4">{stepContent}</main>

        {step === 'preview' && (
          <footer className="shrink-0 px-4 py-3 border-t border-bg-border bg-bg-surface flex flex-col gap-2">
            <Button onClick={handleImport} disabled={validRows.length === 0}>
              Confirmar importação ({validRows.length} transações)
            </Button>
            <Button variant="ghost" onClick={goBack}>
              Voltar
            </Button>
          </footer>
        )}
      </div>
    )
  }

  // ── Desktop ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          disabled={step === 'importing'}
          className="text-text-muted hover:text-text-primary text-lg leading-none disabled:opacity-40 transition-colors"
          aria-label="Voltar"
        >
          ←
        </button>
        <h1 className="text-[22px] font-medium tracking-tight text-text-primary">
          Importar CSV
        </h1>
      </div>

      {stepContent}

      {step === 'preview' && (
        <div className="flex gap-3 mt-6">
          <Button variant="ghost" onClick={goBack}>
            Voltar
          </Button>
          <Button onClick={handleImport} disabled={validRows.length === 0}>
            Confirmar importação ({validRows.length} transações)
          </Button>
        </div>
      )}
    </div>
  )
}
