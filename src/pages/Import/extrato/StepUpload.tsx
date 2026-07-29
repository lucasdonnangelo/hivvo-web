import { useRef, useState } from 'react'
import Spinner from '../../../components/ui/Spinner'

// Espelho do StepUpload da fatura SEM o select de cartão: o extrato é da CONTA,
// não de um cartão — o preview não recebe cartao_id.

interface StepUploadProps {
  arquivo: File | null
  onSelectArquivo: (f: File) => void
  onArquivoInvalido: () => void
  isPreviewing: boolean
  error: string
}

export default function StepUpload({
  arquivo,
  onSelectArquivo,
  onArquivoInvalido,
  isPreviewing,
  error,
}: StepUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function handleFile(file: File) {
    // Bloqueio leve por extensão: o backend confirma pelos magic bytes (%PDF-),
    // mas evitamos gastar uma chamada ao Gemini com um arquivo obviamente errado.
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      onArquivoInvalido()
      return
    }
    onSelectArquivo(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // Extração em andamento: chama o Gemini, leva segundos. Estado claro no lugar
  // do formulário para o usuário não achar que travou.
  if (isPreviewing) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <Spinner size={28} />
        <div className="flex flex-col gap-1">
          <p className="text-sm text-text-primary">Lendo o seu extrato…</p>
          <p className="text-xs text-text-muted">
            Isso pode levar alguns segundos. Não feche a página.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-text-muted">Arquivo do extrato (PDF)</label>
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
          {arquivo ? (
            <p className="text-sm text-text-primary text-center break-all">{arquivo.name}</p>
          ) : (
            <>
              <p className="text-sm text-text-primary text-center">
                Arraste o extrato em <span className="text-amber">.pdf</span> ou clique para selecionar
              </p>
              <p className="text-xs text-text-muted">
                Envie o PDF original emitido pelo banco (extrato da conta, não fatura)
              </p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
