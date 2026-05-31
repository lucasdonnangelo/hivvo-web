import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import type { Transaction } from '../../services/transactions'
import TransactionGroup from '../../components/transaction/TransactionGroup'
import EditTransactionModal from '../../components/transaction/EditTransactionModal'
import DeleteConfirmModal from '../../components/transaction/DeleteConfirmModal'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'

// ─── constants ───────────────────────────────────────────────────────────────

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const FORMAS_PAGAMENTO = ['Débito', 'Crédito', 'PIX', 'Dinheiro', 'TED/DOC']

type Tipo = 'todos' | 'receita' | 'despesa'

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

// ─── icons ────────────────────────────────────────────────────────────────────

function ChartBarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

// ─── chip (mobile filter tag) ─────────────────────────────────────────────────

interface ChipProps {
  active?: boolean
  onClick: () => void
  children: ReactNode
  showRemove?: boolean
}

function Chip({ active, onClick, children, showRemove }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
        active
          ? 'bg-amber text-bg'
          : 'bg-bg-surface text-text-muted border border-bg-border hover:text-text-primary',
      ].join(' ')}
    >
      {children}
      {showRemove && <span className="opacity-70 leading-none">✕</span>}
    </button>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()
  const now = new Date()

  // Month navigation
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const isCurrentMonth = mes === now.getMonth() + 1 && ano === now.getFullYear()

  const prevMonth = () => {
    if (mes === 1) { setMes(12); setAno((a) => a - 1) }
    else setMes((m) => m - 1)
  }
  const nextMonth = () => {
    if (isCurrentMonth) return
    if (mes === 12) { setMes(1); setAno((a) => a + 1) }
    else setMes((m) => m + 1)
  }

  // Filters
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<Tipo>('todos')
  const [filtroCategorias, setFiltroCategorias] = useState<string[]>([])
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState('')

  // Mobile filter modal state
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [tempCategorias, setTempCategorias] = useState<string[]>([])
  const [tempFormaPag, setTempFormaPag] = useState('')

  // Transaction modals
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null)
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null)

  // Data fetching
  const { data: transactions = [], isLoading, isError } = useTransactions(mes, ano)
  const { data: categoriesData = [] } = useCategories()

  // Mutations
  const deleteMutation = useDeleteTransaction(mes, ano)
  const updateMutation = useUpdateTransaction(mes, ano)

  // Category options: union of API categories + categories seen in transactions
  const allCategoryOptions = useMemo(() => {
    const fromApi = categoriesData.map((c) => c.nome)
    const fromTx = transactions.map((tx) => tx.categoria)
    return [...new Set([...fromApi, ...fromTx])].sort()
  }, [categoriesData, transactions])

  // Filtered transactions
  const filteredTx = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (filtroTipo !== 'todos' && tx.tipo !== filtroTipo) return false
        if (filtroCategorias.length > 0 && !filtroCategorias.includes(tx.categoria)) return false
        if (filtroFormaPagamento && tx.forma_pagamento !== filtroFormaPagamento) return false
        if (busca.trim()) {
          const q = busca.toLowerCase()
          if (
            !tx.descricao.toLowerCase().includes(q) &&
            !tx.categoria.toLowerCase().includes(q)
          )
            return false
        }
        return true
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
  }, [transactions, filtroTipo, filtroCategorias, filtroFormaPagamento, busca])

  // Transactions grouped by date (Map preserves insertion order)
  const groupedTx = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const tx of filteredTx) {
      const group = map.get(tx.data) ?? []
      map.set(tx.data, [...group, tx])
    }
    return map
  }, [filteredTx])

  // Net total of filtered transactions
  const totalFiltrado = useMemo(
    () =>
      filteredTx.reduce((acc, tx) => {
        const v = parseFloat(tx.valor)
        return acc + (tx.tipo === 'receita' ? v : -v)
      }, 0),
    [filteredTx],
  )

  const hasActiveFilters =
    filtroTipo !== 'todos' ||
    filtroCategorias.length > 0 ||
    filtroFormaPagamento !== '' ||
    busca !== ''

  const clearFilters = () => {
    setBusca('')
    setFiltroTipo('todos')
    setFiltroCategorias([])
    setFiltroFormaPagamento('')
  }

  const handleConfirmDelete = () => {
    if (!txToDelete) return
    deleteMutation.mutate(txToDelete.id, { onSuccess: () => setTxToDelete(null) })
  }

  const handleSaveEdit = (id: number, payload: Partial<Omit<Transaction, 'id'>>) => {
    updateMutation.mutate({ id, payload }, { onSuccess: () => setTxToEdit(null) })
  }

  // ─── shared fragments ──────────────────────────────────────────────────────

  const monthNav = (
    <div className="flex items-center gap-2">
      <button
        onClick={prevMonth}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <span className="text-sm font-medium text-text-primary whitespace-nowrap">
        {MONTHS[mes - 1]} {ano}
      </span>
      <button
        onClick={nextMonth}
        disabled={isCurrentMonth}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Próximo mês"
      >
        ›
      </button>
    </div>
  )

  const totalSummary = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted">
        {filteredTx.length} transaç{filteredTx.length !== 1 ? 'ões' : 'ão'}
      </span>
      <span
        className={`text-sm font-medium ${
          totalFiltrado >= 0 ? 'text-success' : 'text-danger'
        }`}
      >
        {totalFiltrado >= 0 ? '+' : ''}
        {formatBRL(totalFiltrado)}
      </span>
    </div>
  )

  const transactionList = (
    <>
      {filteredTx.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center mb-4">
            <span className="text-amber text-lg">◇</span>
          </div>
          <p className="text-text-primary font-medium">
            {transactions.length === 0 ? 'Sem transações' : 'Nenhum resultado'}
          </p>
          <p className="text-text-muted text-sm mt-1">
            {transactions.length === 0
              ? `Nenhuma movimentação em ${MONTHS[mes - 1]} ${ano}`
              : 'Tente ajustar os filtros ou a busca'}
          </p>
          {hasActiveFilters && transactions.length > 0 && (
            <button
              onClick={clearFilters}
              className="mt-4 text-xs text-amber hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        [...groupedTx.entries()].map(([date, txs]) => (
          <TransactionGroup
            key={date}
            date={date}
            transactions={txs}
            onEdit={setTxToEdit}
            onDelete={setTxToDelete}
          />
        ))
      )}
    </>
  )

  // ─── shared modals ─────────────────────────────────────────────────────────

  const modals = (
    <>
      {txToEdit && (
        <EditTransactionModal
          tx={txToEdit}
          categories={allCategoryOptions}
          onSave={handleSaveEdit}
          onClose={() => setTxToEdit(null)}
          isLoading={updateMutation.isPending}
        />
      )}
      {txToDelete && (
        <DeleteConfirmModal
          tx={txToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setTxToDelete(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </>
  )

  // ─── loading / error ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-bg-surface rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center p-6">
        <p className="text-danger font-medium">Erro ao carregar transações</p>
        <p className="text-text-muted text-sm mt-1">Verifique sua conexão e tente novamente.</p>
      </div>
    )
  }

  // ─── mobile layout ─────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Month nav */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-bg-border">
          {monthNav}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-xs text-amber hover:underline">
              Limpar
            </button>
          )}
        </div>

        {/* Search */}
        <div className="shrink-0 px-4 py-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar transação..."
            className="w-full px-3 py-2 rounded-md text-sm text-text-primary bg-bg-surface border border-bg-border placeholder:text-text-muted focus:outline-none focus:border-amber transition-colors"
          />
        </div>

        {/* Filter chips */}
        <div className="shrink-0 flex items-center gap-2 overflow-x-auto px-4 pb-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <Chip active={filtroTipo === 'todos'} onClick={() => setFiltroTipo('todos')}>
            Todos
          </Chip>
          <Chip
            active={filtroTipo === 'receita'}
            onClick={() => setFiltroTipo('receita')}
          >
            Receita
          </Chip>
          <Chip
            active={filtroTipo === 'despesa'}
            onClick={() => setFiltroTipo('despesa')}
          >
            Despesa
          </Chip>

          <div className="w-px h-5 bg-bg-border shrink-0" />
          <button
            onClick={() => navigate('/transactions/summary')}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-amber text-amber hover:bg-amber/5 transition-colors"
          >
            <ChartBarIcon />
            Resumo
          </button>

          {filtroCategorias.length > 0 && (
            <div className="w-px h-5 bg-bg-border shrink-0" />
          )}
          {filtroCategorias.map((cat) => (
            <Chip
              key={cat}
              active
              showRemove
              onClick={() =>
                setFiltroCategorias((prev) => prev.filter((c) => c !== cat))
              }
            >
              {cat}
            </Chip>
          ))}

          {filtroFormaPagamento && (
            <Chip active showRemove onClick={() => setFiltroFormaPagamento('')}>
              {filtroFormaPagamento}
            </Chip>
          )}

          <button
            onClick={() => {
              setTempCategorias(filtroCategorias)
              setTempFormaPag(filtroFormaPagamento)
              setFilterModalOpen(true)
            }}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-bg-surface text-text-muted border border-bg-border hover:text-text-primary transition-colors"
          >
            + Filtros
          </button>
        </div>

        {/* Total */}
        <div className="shrink-0 px-4 py-2 border-b border-bg-border">
          {totalSummary}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4">{transactionList}</div>

        {/* Mobile filter modal */}
        {filterModalOpen && (
          <Modal
            title="Filtros"
            onClose={() => setFilterModalOpen(false)}
            footer={
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setTempCategorias([])
                    setTempFormaPag('')
                  }}
                >
                  Limpar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setFiltroCategorias(tempCategorias)
                    setFiltroFormaPagamento(tempFormaPag)
                    setFilterModalOpen(false)
                  }}
                >
                  Aplicar
                </Button>
              </div>
            }
          >
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-xs font-medium text-text-muted mb-3">Forma de pagamento</p>
                <div className="flex flex-col gap-2">
                  {['', ...FORMAS_PAGAMENTO].map((f) => (
                    <label
                      key={f || '__todas'}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        checked={tempFormaPag === f}
                        onChange={() => setTempFormaPag(f)}
                        className="accent-amber"
                      />
                      <span className="text-sm text-text-primary">{f || 'Todas'}</span>
                    </label>
                  ))}
                </div>
              </div>

              {allCategoryOptions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-3">Categorias</p>
                  <div className="flex flex-col gap-2">
                    {allCategoryOptions.map((cat) => (
                      <label key={cat} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tempCategorias.includes(cat)}
                          onChange={(e) =>
                            setTempCategorias((prev) =>
                              e.target.checked
                                ? [...prev, cat]
                                : prev.filter((c) => c !== cat),
                            )
                          }
                          className="accent-amber"
                        />
                        <span className="text-sm text-text-primary">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        )}

        {modals}
      </div>
    )
  }

  // ─── desktop layout ────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* Left filter panel */}
      <aside className="w-64 shrink-0 border-r border-bg-border flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-bg-border">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar transação..."
            className="w-full px-3 py-2 rounded-md text-sm text-text-primary bg-bg border border-bg-border placeholder:text-text-muted focus:outline-none focus:border-amber transition-colors"
          />
        </div>

        <div className="flex flex-col gap-5 p-4 flex-1">
          {/* Tipo */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">Tipo</p>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: 'todos', label: 'Todos' },
                  { value: 'receita', label: 'Receita' },
                  { value: 'despesa', label: 'Despesa' },
                ] as { value: Tipo; label: string }[]
              ).map(({ value, label }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={filtroTipo === value}
                    onChange={() => setFiltroTipo(value)}
                    className="accent-amber"
                  />
                  <span className="text-sm text-text-primary">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Forma de pagamento */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-2">Forma de pagamento</p>
            <div className="flex flex-col gap-2">
              {['', ...FORMAS_PAGAMENTO].map((f) => (
                <label key={f || '__todas'} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={filtroFormaPagamento === f}
                    onChange={() => setFiltroFormaPagamento(f)}
                    className="accent-amber"
                  />
                  <span className="text-sm text-text-primary">{f || 'Todas'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Categorias */}
          {allCategoryOptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-2">Categorias</p>
              <div className="flex flex-col gap-2">
                {allCategoryOptions.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filtroCategorias.includes(cat)}
                      onChange={(e) =>
                        setFiltroCategorias((prev) =>
                          e.target.checked
                            ? [...prev, cat]
                            : prev.filter((c) => c !== cat),
                        )
                      }
                      className="accent-amber"
                    />
                    <span className="text-sm text-text-primary">{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <div className="p-4 border-t border-bg-border">
            <button onClick={clearFilters} className="text-xs text-amber hover:underline">
              Limpar filtros
            </button>
          </div>
        )}
      </aside>

      {/* Right content */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-bg-border">
          {monthNav}
          <div className="flex items-center gap-4">
            {totalSummary}
            <button
              onClick={() => navigate('/transactions/summary')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border border-amber text-amber hover:bg-amber/5 active:bg-amber/10 transition-colors whitespace-nowrap"
            >
              <ChartBarIcon />
              Ver resumo
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{transactionList}</div>
      </div>

      {modals}
    </div>
  )
}
