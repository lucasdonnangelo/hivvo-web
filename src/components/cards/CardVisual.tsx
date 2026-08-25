import type { Card } from '../../services/cards'

const formatBRL = (v: string | number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    typeof v === 'string' ? parseFloat(v) : v,
  )

const TIPO_LABEL: Record<Card['tipo'], string> = {
  'Crédito': 'Crédito',
  'Débito': 'Débito',
  'Ambos': 'Crédito e Débito',
}

interface CardVisualProps {
  card: Card
  selected?: boolean
  onClick?: () => void
}

export default function CardVisual({ card, selected, onClick }: CardVisualProps) {
  // Limite pode ser null (cartão sem limite pré-definido) — degrada sem barra nem
  // percentual (nada de NaN%/divisão por null). `hasLimite` guarda TODO o cálculo.
  const limite = card.limite != null ? parseFloat(card.limite) : NaN
  const hasLimite = !isNaN(limite) && limite > 0

  // COMPROMETIDO, não "usado". A palavra é o conserto: "usado" era o mesmo termo
  // para dois conceitos (fatura aberta × limite consumido) e foi o que deixou a
  // barra subtrair uma competência do limite. O número vem pronto do backend
  // (`limite_usado`), que é quem tem PagamentoFatura e as parcelas futuras.
  const comprometido = parseFloat(card.limite_usado ?? '0')

  // Comprometido ACIMA do limite não é erro de conta. As duas causas possíveis
  // são fatura sem pagamento confirmado E limite digitado errado no cadastro, e
  // a tela não tem como saber qual — por isso a cópia oferece as duas ações em
  // vez de afirmar uma causa. Não imprimimos "R$ 0,00 disponível" aqui: isso
  // responde outra pergunta e esconde o motivo.
  const estourado = hasLimite && comprometido > limite
  const disponivel = hasLimite ? limite - comprometido : 0
  const excedente = estourado ? comprometido - limite : 0
  const pct = hasLimite ? Math.min(100, Math.max(0, (comprometido / limite) * 100)) : 0

  return (
    <button
      onClick={onClick}
      className={[
        'relative w-full rounded-xl p-5 text-left transition-all select-none',
        'bg-gradient-to-br from-amber-dark via-amber to-amber-light',
        selected
          ? 'ring-2 ring-amber ring-offset-2 ring-offset-bg shadow-lg shadow-amber/20'
          : 'opacity-80 hover:opacity-100',
      ].join(' ')}
    >
      {/* top row */}
      <div className="flex items-start justify-between mb-6">
        <span className="text-bg font-semibold text-base tracking-tight truncate max-w-[160px]">
          {card.nome}
        </span>
        <span className="bg-bg/20 text-bg/80 text-xs font-medium rounded-full px-2 py-0.5 whitespace-nowrap shrink-0">
          {TIPO_LABEL[card.tipo]}
        </span>
      </div>

      {/* limit + usage bar */}
      <div>
        <p className="text-bg/60 text-xs mb-0.5">Limite</p>
        {hasLimite ? (
          <>
            <p className="text-bg font-semibold text-lg">{formatBRL(limite)}</p>
            <div className="mt-2">
              <div className="w-full h-1 rounded-full bg-bg/20 overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all',
                    // Barra cheia por estouro não pode ler igual a "bateu o
                    // limite na régua" — opacidade cheia separa os dois.
                    estourado ? 'bg-bg' : 'bg-bg/60',
                  ].join(' ')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {estourado ? (
                <>
                  <p className="mt-1 text-[10px] text-bg">
                    {formatBRL(comprometido)} comprometido · {formatBRL(excedente)} acima
                    do limite
                  </p>
                  <p className="mt-0.5 text-[10px] text-bg/70">
                    Confirme os pagamentos das faturas — ou revise o limite do cartão.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-[10px] text-bg/60">
                  {formatBRL(comprometido)} comprometido · {formatBRL(disponivel)}{' '}
                  disponível
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-bg font-semibold text-lg">Sem limite definido</p>
            {comprometido > 0 && (
              <p className="mt-1 text-[10px] text-bg/60">
                {formatBRL(comprometido)} comprometido
              </p>
            )}
          </>
        )}
      </div>
    </button>
  )
}
