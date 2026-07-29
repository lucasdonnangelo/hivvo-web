import type { ExtratoCommitResponse } from '../../../services/importExtrato'
import { plural } from './helpers'

interface StepReciboProps {
  recibo: ExtratoCommitResponse
}

export default function StepRecibo({ recibo }: StepReciboProps) {
  // Sempre mostradas — o que foi de fato gravado.
  const principais = [
    plural(recibo.receitas_criadas, 'receita criada', 'receitas criadas'),
    plural(recibo.debitos_criados, 'débito criado', 'débitos criados'),
    plural(
      recibo.pagamentos_registrados,
      'pagamento de fatura registrado',
      'pagamentos de fatura registrados',
    ),
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 text-center py-2">
        <span className="w-12 h-12 rounded-full bg-success/10 border border-success/30 flex items-center justify-center text-success text-xl">
          ✓
        </span>
        <h2 className="text-base font-medium text-text-primary">Extrato importado</h2>
      </div>

      <ul className="flex flex-col gap-1.5">
        {principais.map((linha) => (
          <li key={linha} className="text-sm text-text-primary">
            · {linha}
          </li>
        ))}
        {recibo.rendimento_importado && (
          <li className="text-sm text-text-primary">· rendimento importado como receita “Rendimentos”</li>
        )}
      </ul>

      {/* Explicações só quando houve algo a explicar (senão viram ruído). */}
      {recibo.pagamentos_sobrescritos > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-bg-border bg-bg-surface p-3">
          <p className="text-xs text-text-muted">
            <span className="text-text-primary">
              {plural(
                recibo.pagamentos_sobrescritos,
                'fatura já constava paga',
                'faturas já constavam pagas',
              )}
            </span>{' '}
            — o valor assumido foi substituído pelo valor real do extrato. Se o real cobre
            menos que o total, a fatura passa a “paga parcial”.
          </p>
        </div>
      )}

      {recibo.receitas_puladas_recorrencia > 0 && (
        <p className="text-sm text-amber flex items-center gap-1.5">
          <span aria-hidden>⚠</span>
          <span>
            {plural(
              recibo.receitas_puladas_recorrencia,
              'receita deixada de fora',
              'receitas deixadas de fora',
            )}
          </span>
          <span className="text-xs text-text-muted">
            — já cobertas por uma recorrência; importar duplicaria
          </span>
        </p>
      )}

      {recibo.linhas_ignoradas > 0 && (
        <p className="text-xs text-text-muted">
          {plural(recibo.linhas_ignoradas, 'linha não importada', 'linhas não importadas')}{' '}
          (desmarcadas na revisão ou sem fatura correspondente).
        </p>
      )}

      {!recibo.reconciliacao_bate && (
        <p className="text-xs text-text-muted">
          Lembrete: as movimentações não bateram exatamente com os saldos do banco. Confira em
          Transações se algo ficou de fora.
        </p>
      )}
    </div>
  )
}
