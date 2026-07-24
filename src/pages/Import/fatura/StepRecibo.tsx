import type { FaturaCommitResponse } from '../../../services/importFatura'

const plural = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`

interface StepReciboProps {
  recibo: FaturaCommitResponse
}

export default function StepRecibo({ recibo }: StepReciboProps) {
  // Sempre mostradas — o que foi de fato gravado.
  const principais = [
    plural(recibo.transacoes_criadas, 'transação criada', 'transações criadas'),
    plural(recibo.parcelas_criadas, 'parcela criada', 'parcelas criadas'),
    plural(recibo.faturas_marcadas_pagas, 'fatura marcada como paga', 'faturas marcadas como pagas'),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center py-2">
        <span className="w-12 h-12 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-success text-xl">
          ✓
        </span>
        <h2 className="text-base font-medium text-text-primary">Fatura importada</h2>
      </div>

      <ul className="flex flex-col gap-1.5">
        {principais.map((linha) => (
          <li key={linha} className="text-sm text-text-primary">
            · {linha}
          </li>
        ))}
      </ul>

      {/* Estornos importados: resultado POSITIVO (créditos gravados que abatem o
          consumo), em amber — a mesma linguagem visual do estorno no resto do app. */}
      {recibo.estornos_importados > 0 && (
        <p className="text-sm text-amber flex items-center gap-1.5">
          <span aria-hidden>↩</span>
          <span>
            {plural(recibo.estornos_importados, 'estorno importado', 'estornos importados')}
          </span>
          <span className="text-xs text-text-muted">— créditos que abatem o consumo</span>
        </p>
      )}

      {/* Explicações só quando houve algo a explicar (senão viram ruído). */}
      {recibo.parceladas_deduplicadas > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-bg-border bg-bg-surface p-3">
          <p className="text-xs text-text-muted">
            <span className="text-text-primary">
              {plural(recibo.parceladas_deduplicadas, 'parcela já existente', 'parcelas já existentes')}
            </span>{' '}
            — a mesma compra parcelada já tinha sido importada em outra fatura; não duplicamos.
          </p>
        </div>
      )}

      {!recibo.reconciliacao_bate && (
        <p className="text-xs text-text-muted">
          Lembrete: os lançamentos não bateram exatamente com o total do banco. Confira em
          Transações se algo ficou de fora.
        </p>
      )}
    </div>
  )
}
