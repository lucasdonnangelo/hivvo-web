import { useState } from 'react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import {
  useCards,
  useCreateCard,
  useUpdateCard,
  useDeactivateCard,
  useInvoices,
  useInvoiceDetail,
} from '../../hooks/useCards'
import type { Card, CardPayload } from '../../services/cards'
import CardVisual from '../../components/cards/CardVisual'
import CardFormModal from '../../components/cards/CardFormModal'
import InvoiceMonthGrid from '../../components/cards/InvoiceMonthGrid'
import InvoiceDetailPanel from '../../components/cards/InvoiceDetail'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'

// ─── helpers ──────────────────────────────────────────────────────────────────

function currentMonthYear() {
  const now = new Date()
  return { mes: now.getMonth() + 1, ano: now.getFullYear() }
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
  onExport: () => void
}

function InvoicePanel({ cardId, mes, ano, onMonthSelect, onExport }: InvoicePanelProps) {
  const { data: invoices = [], isLoading: loadingList } = useInvoices(cardId)
  const { data: detail, isLoading: loadingDetail } = useInvoiceDetail(cardId, ano, mes)

  if (loadingList || loadingDetail) {
    return (
      <div className="flex flex-col gap-3 p-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-bg-surface rounded-lg animate-pulse" />
        ))}
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
            mes={mes}
            ano={ano}
            onExport={onExport}
          />
        </>
      )}
    </div>
  )
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-14 h-14 rounded-full bg-bg-surface flex items-center justify-center mb-4">
        <span className="text-amber text-2xl">▤</span>
      </div>
      <p className="text-text-primary font-medium">Nenhum cartão cadastrado</p>
      <p className="text-text-muted text-sm mt-1 mb-5">
        Adicione um cartão para acompanhar faturas e parcelamentos
      </p>
      <Button onClick={onAdd}>Adicionar cartão</Button>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function CardsPage() {
  const isMobile = useBreakpoint('md')
  const { mes: initMes, ano: initAno } = currentMonthYear()

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
        { onSuccess: () => setCardToEdit(null) },
      )
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => {
          setShowAddModal(false)
          setSelectedCardId(created.id)
        },
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
    })
  }

  const handleExport = () => {
    console.log('TODO: exportar fatura', effectiveCardId, invoiceAno, invoiceMes)
  }

  // ─── loading ───────────────────────────────────────────────────────────────

  if (loadingCards) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-bg-surface rounded-xl animate-pulse" />
        ))}
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
    </>
  )

  // ─── mobile layout ─────────────────────────────────────────────────────────

  if (isMobile) {
    if (activeCards.length === 0) {
      return (
        <>
          <EmptyState onAdd={() => setShowAddModal(true)} />
          {modals}
        </>
      )
    }

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
              onExport={handleExport}
            />
          )}
        </div>

        {modals}
      </div>
    )
  }

  // ─── desktop layout ────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
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

        {activeCards.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
            <p className="text-text-muted text-sm">Nenhum cartão</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-xs text-amber hover:underline"
            >
              Adicionar agora
            </button>
          </div>
        ) : (
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
        )}
      </aside>

      {/* Right panel — invoice */}
      <div className="flex-1 overflow-y-auto p-6">
        {effectiveCardId ? (
          <InvoicePanel
            cardId={effectiveCardId}
            mes={invoiceMes}
            ano={invoiceAno}
            onMonthSelect={handleMonthSelect}
            onExport={handleExport}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-text-muted text-sm">Selecione um cartão para ver as faturas</p>
          </div>
        )}
      </div>

      {modals}
    </div>
  )
}
