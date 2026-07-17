import type { FaturaPassada } from '../../../services/importFatura'
import { formatCompetencia } from './helpers'

interface StepPassadasProps {
  passadas: FaturaPassada[]
  // só as competências controláveis (ja_paga=false); chave "mes-ano"
  passadasPagas: Record<string, boolean>
  onTogglePassada: (key: string) => void
  cardNome: string
  error: string
}

export default function StepPassadas({
  passadas,
  passadasPagas,
  onTogglePassada,
  cardNome,
  error,
}: StepPassadasProps) {
  const jaPagas = passadas.filter((p) => p.ja_paga)
  const controlaveis = passadas.filter((p) => !p.ja_paga)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-sm font-medium text-text-primary">Confirmar importação</h2>
        <p className="text-sm text-text-muted">
          Cartão <span className="text-text-primary">{cardNome}</span>.
        </p>
      </div>

      {passadas.length === 0 ? (
        <p className="text-sm text-text-muted">
          Esta importação não cria faturas de meses anteriores. É só confirmar.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">
            As parcelas desta fatura também criam faturas de meses passados. Marque as que você{' '}
            <span className="text-text-primary">já pagou</span> — as desmarcadas aparecem em
            “A pagar”.
          </p>

          {controlaveis.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {controlaveis.map((p) => {
                const key = `${p.mes}-${p.ano}`
                const marcada = passadasPagas[key] ?? false
                return (
                  <label
                    key={key}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-bg-border bg-bg-surface cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => onTogglePassada(key)}
                      className="accent-amber w-4 h-4"
                    />
                    <span className="text-sm text-text-primary">
                      Fatura de {formatCompetencia(p.mes, p.ano)}
                    </span>
                    <span className="ml-auto text-xs text-text-muted">
                      {marcada ? 'paga' : 'em aberto'}
                    </span>
                  </label>
                )
              })}
            </div>
          )}

          {jaPagas.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-text-muted">Já confirmadas como pagas:</p>
              <div className="flex flex-wrap gap-1.5">
                {jaPagas.map((p) => (
                  <span
                    key={`${p.mes}-${p.ano}`}
                    className="text-xs text-success bg-success/5 border border-success/30 rounded-full px-2.5 py-1"
                  >
                    ✓ {formatCompetencia(p.mes, p.ano)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
