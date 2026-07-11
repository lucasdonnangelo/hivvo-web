import { useEffect, useRef, useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import {
  useCards,
  useCreateCard,
  useUpdateCard,
  useDeactivateCard,
  useInvoices,
  useInvoiceDetail,
  useNextDueInvoice,
} from '../../hooks/useCards'
import type { Card, CardPayload } from '../../services/cards'
import CardVisual from '../../components/cards/CardVisual'
import CardFormModal from '../../components/cards/CardFormModal'
import InvoiceMonthGrid from '../../components/cards/InvoiceMonthGrid'
import InvoiceDetailPanel from '../../components/cards/InvoiceDetail'
import InvoiceByMonthView from '../../components/cards/InvoiceByMonthView'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import EmptyState from '../../components/ui/EmptyState'
import { useUIStore } from '../../store/uiStore'

type ViewMode = 'card' | 'month'

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentMonthYear() {
  const now = new Date()
  return { mes: now.getMonth() + 1, ano: now.getFullYear() }
}

// Extrai o `detail` do erro do FastAPI (string, array com `.msg`, ou objeto). Usado
// para exibir o motivo REAL do 422 (ex.: bloqueio de edição de datas) em vez de um
// genérico. Cai no fallback quando não há detail (rede/500 sem corpo).
function extractDetail(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (first && typeof first === 'object' && 'msg' in first) {
      return String((first as { msg: unknown }).msg)
    }
    return String(first)
  }
  return fallback
}

// ─── deactivate confirm modal ─────────────────────────────────────────────────

interface DeactivateModalProps {
  card: Card
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

function DeactivateModal({ card, onConfirm, onCancel, isLoading }: DeactivateModalProps) {
  return (
    <Modal
      title="Desativar cartão"
      onClose={onCancel}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            className="flex-1 !bg-danger hover:!bg-danger/80"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            Desativar
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-primary">
        Deseja desativar o cartão <span className="font-semibold">{card.nome}</span>? Ele não
        aparecerá mais nas listagens, mas o histórico de transações será mantido.
      </p>
    </Modal>
  )
}

// ─── invoice panel wrapper (fetches + renders) ────────────────────────────────

interface InvoicePanelProps {
  cardId: number
  mes: number
  ano: number
  onMonthSelect: (ano: number, mes: number) => void
}

function InvoicePanel({ cardId, mes, ano, onMonthSelect }: InvoicePanelProps) {
  const { data: invoices = [], isLoading: loadingList } = useInvoices(cardId)
  const { data: detail, isLoading: loadingDetail } = useInvoiceDetail(cardId, ano, mes)

  if (loadingList || loadingDetail) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-6 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <div key={i} className="h-8 bg-bg-surface rounded-md animate-pulse" />
          ))}
        </div>
        <div className="border-t border-bg-border" />
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <InvoiceMonthGrid
        invoices={invoices}
        selectedMes={mes}
        selectedAno={ano}
        onSelect={onMonthSelect}
      />

      {detail && (
        <>
          <div className="border-t border-bg-border" />
          <InvoiceDetailPanel
            detail={detail}
            cardId={cardId}
            mes={mes}
            ano={ano}
          />
        </>
      )}
    </div>
  )
}

// ─── view toggle (por cartão ↔ por mês) ───────────────────────────────────────

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { key: ViewMode; label: string }[] = [
    { key: 'card', label: 'Por cartão' },
    { key: 'month', label: 'Por mês' },
  ]
  return (
    <div className="inline-flex rounded-md bg-bg-surface p-0.5 border border-bg-border">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={[
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            value === o.key
              ? 'bg-amber text-bg'
              : 'text-text-muted hover:text-text-primary',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── month-mode invoice detail (modal, reusa InvoiceDetailPanel) ───────────────

interface MonthDetailModalProps {
  cardId: number
  cardNome: string
  mes: number
  ano: number
  onClose: () => void
}

function MonthDetailModal({ cardId, cardNome, mes, ano, onClose }: MonthDetailModalProps) {
  const { data: detail, isLoading } = useInvoiceDetail(cardId, ano, mes)

  return (
    <Modal title={cardNome} onClose={onClose}>
      {isLoading || !detail ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-bg rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <InvoiceDetailPanel detail={detail} cardId={cardId} mes={mes} ano={ano} />
      )}
    </Modal>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CardsPage() {
  const isMobile = useBreakpoint('md')
  const { mes: initMes, ano: initAno } = currentMonthYear()
  const addToast = useUIStore((s) => s.addToast)

  const { data: allCards = [], isLoading: loadingCards } = useCards()
  const activeCards = allCards.filter((c) => c.ativo)

  // Selected card
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const selectedCard = activeCards.find((c) => c.id === selectedCardId) ?? activeCards[0] ?? null
  const effectiveCardId = selectedCard?.id ?? null

  // Selected invoice month
  const [invoiceMes, setInvoiceMes] = useState(initMes)
  const [invoiceAno, setInvoiceAno] = useState(initAno)

  const handleMonthSelect = (ano: number, mes: number) => {
    setInvoiceAno(ano)
    setInvoiceMes(mes)
  }

  // ─── modo "por mês" (lente 3d: 1 mês × N cartões) ───────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('card')

  const [monthViewMes, setMonthViewMes] = useState(initMes)
  const [monthViewAno, setMonthViewAno] = useState(initAno)

  // Mês default da tela = próxima fatura a vencer (derivado no backend, não no
  // front). Aplicado UMA vez, antes de qualquer navegação do usuário — depois a
  // navegação é livre e não é sobrescrita pelo default.
  const { data: nextDue } = useNextDueInvoice()
  const nextDueApplied = useRef(false)
  useEffect(() => {
    if (nextDue && !nextDueApplied.current) {
      nextDueApplied.current = true
      setMonthViewMes(nextDue.mes)
      setMonthViewAno(nextDue.ano)
    }
  }, [nextDue])

  const monthPrev = () => {
    if (monthViewMes === 1) {
      setMonthViewMes(12)
      setMonthViewAno((a) => a - 1)
    } else {
      setMonthViewMes((m) => m - 1)
    }
  }
  const monthNext = () => {
    if (monthViewMes === 12) {
      setMonthViewMes(1)
      setMonthViewAno((a) => a + 1)
    } else {
      setMonthViewMes((m) => m + 1)
    }
  }

  // Detalhe de uma fatura no modo "por mês" (modal reusando InvoiceDetailPanel)
  const [monthDetailCardId, setMonthDetailCardId] = useState<number | null>(null)
  const monthDetailCard = allCards.find((c) => c.id === monthDetailCardId) ?? null

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null)
  const [cardToDeactivate, setCardToDeactivate] = useState<Card | null>(null)

  // Mutations
  const createMutation = useCreateCard()
  const updateMutation = useUpdateCard()
  const deactivateMutation = useDeactivateCard()

  const handleSaveCard = (payload: CardPayload) => {
    if (cardToEdit) {
      updateMutation.mutate(
        { id: cardToEdit.id, payload },
        {
          onSuccess: () => setCardToEdit(null),
          // 422 "que escape" (ex.: bloqueio de datas) → mostra o detail do backend,
          // não o genérico.
          onError: (err) =>
            addToast({
              message: extractDetail(err, 'Erro ao atualizar cartão. Tente novamente.'),
              type: 'error',
            }),
        },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => {
          setShowAddModal(false)
          setSelectedCardId(created.id)
        },
        onError: () => addToast({ message: 'Erro ao adicionar cartão. Verifique os dados e tente novamente.', type: 'error' }),
      })
    }
  }

  const handleDeactivate = () => {
    if (!cardToDeactivate) return
    deactivateMutation.mutate(cardToDeactivate.id, {
      onSuccess: () => {
        setCardToDeactivate(null)
        setSelectedCardId(null)
      },
      onError: () => addToast({ message: 'Erro ao desativar cartão. Tente novamente.', type: 'error' }),
    })
  }

  // ─── loading ───────────────────────────────────────────────────────────────

  if (loadingCards) {
    if (isMobile) {
      return (
        <div className="flex flex-col h-full">
          <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3">
            <div className="h-5 w-16 bg-bg-surface rounded animate-pulse" />
            <div className="w-8 h-8 bg-bg-surface rounded-full animate-pulse" />
          </div>
          <div className="shrink-0 h-36 mx-4 mb-1 bg-bg-surface rounded-xl animate-pulse" />
          <div className="shrink-0 flex gap-2 px-4 pt-3 pb-4">
            <div className="flex-1 h-8 bg-bg-surface rounded-md animate-pulse" />
            <div className="flex-1 h-8 bg-bg-surface rounded-md animate-pulse" />
          </div>
          <div className="flex flex-col gap-3 px-4">
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-8 bg-bg-surface rounded-md animate-pulse" />
              ))}
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-bg-surface rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="flex h-full">
        <aside className="w-72 shrink-0 border-r border-bg-border flex flex-col p-4 gap-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-16 bg-bg-surface rounded animate-pulse" />
            <div className="w-7 h-7 bg-bg-surface rounded-full animate-pulse" />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-bg-surface rounded-xl animate-pulse" />
          ))}
        </aside>
        <div className="flex-1 p-6 flex flex-col gap-4">
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="h-8 bg-bg-surface rounded-md animate-pulse" />
            ))}
          </div>
          <div className="border-t border-bg-border" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ─── modals (shared) ───────────────────────────────────────────────────────

  const modals = (
    <>
      {(showAddModal || cardToEdit) && (
        <CardFormModal
          card={cardToEdit ?? undefined}
          onSave={handleSaveCard}
          onClose={() => {
            setShowAddModal(false)
            setCardToEdit(null)
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
      {cardToDeactivate && (
        <DeactivateModal
          card={cardToDeactivate}
          onConfirm={handleDeactivate}
          onCancel={() => setCardToDeactivate(null)}
          isLoading={deactivateMutation.isPending}
        />
      )}
      {monthDetailCard && (
        <MonthDetailModal
          cardId={monthDetailCard.id}
          cardNome={monthDetailCard.nome}
          mes={monthViewMes}
          ano={monthViewAno}
          onClose={() => setMonthDetailCardId(null)}
        />
      )}
    </>
  )

  // ─── zero cartões — mesmo empty state nos dois modos (mobile + desktop) ──────
  // Retorna ANTES do toggle e do navegador de mês: sem cartões não há o que
  // alternar nem fatura para navegar; a única ação relevante é adicionar cartão.

  if (activeCards.length === 0) {
    return (
      <>
        <EmptyState
          icon="▤"
          title="Você ainda não tem cartões cadastrados"
          description="Adicione um cartão para acompanhar faturas e parcelamentos"
          action={<Button onClick={() => setShowAddModal(true)}>Adicionar cartão</Button>}
        />
        {modals}
      </>
    )
  }

  // ─── mobile layout ─────────────────────────────────────────────────────────

  if (isMobile) {
    const displayCard = selectedCard ?? activeCards[0]

    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3">
          <h1 className="text-base font-medium text-text-primary">Cartões</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-amber text-bg text-lg font-bold hover:bg-amber-light transition-colors"
            aria-label="Adicionar cartão"
          >
            +
          </button>
        </div>

        {/* View toggle */}
        <div className="shrink-0 px-4 pb-3">
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {viewMode === 'card' ? (
          <>
            {/* Card carousel */}
            <div className="shrink-0 overflow-x-auto flex gap-3 px-4 pb-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
              {activeCards.map((card) => (
                <div key={card.id} className="snap-center shrink-0 w-[calc(100vw-64px)]">
                  <CardVisual
                    card={card}
                    selected={displayCard.id === card.id}
                    onClick={() => setSelectedCardId(card.id)}
                  />
                </div>
              ))}
            </div>

            {/* Card actions */}
            <div className="shrink-0 flex gap-2 px-4 pb-4">
              <button
                onClick={() => setCardToEdit(displayCard)}
                className="flex-1 py-1.5 rounded-md text-xs text-text-muted bg-bg-surface border border-bg-border hover:text-text-primary transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => setCardToDeactivate(displayCard)}
                className="flex-1 py-1.5 rounded-md text-xs text-danger bg-bg-surface border border-bg-border hover:bg-danger/10 transition-colors"
              >
                Desativar
              </button>
            </div>

            {/* Invoice panel */}
            <div className="flex-1 px-4 pb-6">
              {effectiveCardId && (
                <InvoicePanel
                  cardId={effectiveCardId}
                  mes={invoiceMes}
                  ano={invoiceAno}
                  onMonthSelect={handleMonthSelect}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 px-4 pb-6">
            <InvoiceByMonthView
              mes={monthViewMes}
              ano={monthViewAno}
              onPrev={monthPrev}
              onNext={monthNext}
              onSelectCard={setMonthDetailCardId}
            />
          </div>
        )}

        {modals}
      </div>
    )
  }

  // ─── desktop layout ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Top bar — view toggle (por cartão ↔ por mês) */}
      <div className="shrink-0 flex items-center px-6 py-3 border-b border-bg-border">
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'month' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <InvoiceByMonthView
            mes={monthViewMes}
            ano={monthViewAno}
            onPrev={monthPrev}
            onNext={monthNext}
            onSelectCard={setMonthDetailCardId}
          />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left panel — card list */}
          <aside className="w-72 shrink-0 border-r border-bg-border flex flex-col">
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-bg-border">
          <h1 className="text-sm font-medium text-text-primary">Cartões</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-amber text-bg text-base font-bold hover:bg-amber-light transition-colors"
            aria-label="Adicionar cartão"
          >
            +
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
          {activeCards.map((card) => (
            <div key={card.id} className="flex flex-col gap-2">
              <CardVisual
                card={card}
                selected={effectiveCardId === card.id}
                onClick={() => setSelectedCardId(card.id)}
              />
              {effectiveCardId === card.id && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setCardToEdit(card)}
                    className="flex-1 py-1.5 rounded-md text-xs text-text-muted bg-bg-surface border border-bg-border hover:text-text-primary transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setCardToDeactivate(card)}
                    className="flex-1 py-1.5 rounded-md text-xs text-danger bg-bg-surface border border-bg-border hover:bg-danger/10 transition-colors"
                  >
                    Desativar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

          {/* Right panel — invoice */}
          <div className="flex-1 overflow-y-auto p-6">
            {effectiveCardId && (
              <InvoicePanel
                cardId={effectiveCardId}
                mes={invoiceMes}
                ano={invoiceAno}
                onMonthSelect={handleMonthSelect}
              />
            )}
          </div>
        </div>
      )}

      {modals}
    </div>
  )
}
