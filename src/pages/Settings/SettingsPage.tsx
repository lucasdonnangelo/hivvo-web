import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { Section, SettingsRow } from '../../components/ui/SettingsSection'
import NewCategoryModal from '../../components/categories/NewCategoryModal'
import { useCategories, useDeleteCategory } from '../../hooks/useCategories'
import {
  useRecorrencias,
  useUpdateRecorrencia,
  useDeleteRecorrencia,
  useDeleteRecorrenciaPermanente,
  useCorrigirValorRecorrencia,
  useRecorrenciaDetail,
} from '../../hooks/useRecorrencias'
import type { Category } from '../../services/categories'
import type { Recorrencia, RecorrenciaUpdate } from '../../services/recorrencias'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { deleteMe, resetData } from '../../services/auth'
import type { ResetDataResponse } from '../../services/auth'
import { getAllTransactions } from '../../services/transactions'
import { clearHistorico } from '../../services/ai'
import { errorDetail } from '../../lib/extractDetail'

// Recorrência não passa por cartão (§3.4) → sem "Crédito".
const FORMAS_RECORRENCIA = ['Débito', 'PIX', 'Dinheiro', 'TED/DOC']

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const recFieldClass =
  'w-full rounded-md bg-bg border border-bg-border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-amber transition-colors'

// Linhas do recibo do "Começar do zero", na ordem em que o usuário pensa nos
// dados (não na ordem da purga). `recorrencia_vigencias` fica DE FORA: é o
// versionamento interno de valor de uma recorrência — o usuário nunca viu isso
// como objeto e "2 vigências" não significaria nada para ele.
const RECIBO_LABELS: [keyof ResetDataResponse, string, string][] = [
  ['transacoes', 'transação', 'transações'],
  ['parcelas', 'parcela', 'parcelas'],
  ['cartoes', 'cartão', 'cartões'],
  ['pagamentos_fatura', 'pagamento de fatura', 'pagamentos de fatura'],
  ['recorrencias', 'recorrência', 'recorrências'],
  ['chat_messages', 'mensagem do Assistente', 'mensagens do Assistente'],
]

function linhasDoRecibo(recibo: ResetDataResponse): string[] {
  return RECIBO_LABELS.filter(([campo]) => recibo[campo] > 0).map(
    ([campo, singular, plural]) =>
      `${recibo[campo]} ${recibo[campo] === 1 ? singular : plural}`,
  )
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const isMobile = useBreakpoint('md')
  const navigate = useNavigate()

  // ── Auth store ────────────────────────────────────────────────────────────
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const addToast = useUIStore((s) => s.addToast)
  const qc = useQueryClient()

  // ── Começar do zero ───────────────────────────────────────────────────────
  // Reautenticação obrigatória: é irreversível (mesmo padrão do excluir conta).
  // O modal tem dois estados: senha → recibo. NÃO desloga: a conta sobrevive.
  const [resetDataModalOpen, setResetDataModalOpen] = useState(false)
  const [resetDataPassword, setResetDataPassword] = useState('')
  const [resetDataError, setResetDataError] = useState('')
  const [isResettingData, setIsResettingData] = useState(false)
  const [resetDataRecibo, setResetDataRecibo] = useState<ResetDataResponse | null>(null)

  function closeResetDataModal() {
    setResetDataModalOpen(false)
    setResetDataPassword('')
    setResetDataError('')
    setResetDataRecibo(null)
  }

  async function handleResetData() {
    if (!resetDataPassword) {
      setResetDataError('Informe sua senha para confirmar.')
      return
    }
    setIsResettingData(true)
    setResetDataError('')
    try {
      const recibo = await resetData(resetDataPassword)
      // Sem filtro: o reset zera tudo, e enumerar as chaves só criaria uma lista
      // para esquecer de atualizar quando nascer a próxima query.
      qc.invalidateQueries()
      setResetDataPassword('')
      setResetDataRecibo(recibo)
    } catch (err: unknown) {
      setResetDataError(errorDetail(err, 'Não foi possível apagar os dados. Tente novamente.'))
    } finally {
      setIsResettingData(false)
    }
  }

  // ── Excluir minha conta ───────────────────────────────────────────────────
  // Reautenticação obrigatória: o backend exige a senha (F-07/LGPD).
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  function closeDeleteModal() {
    setDeleteModalOpen(false)
    setDeletePassword('')
    setDeleteError('')
  }

  async function handleDeleteAccount() {
    if (!deletePassword) {
      setDeleteError('Informe sua senha para confirmar.')
      return
    }
    setIsDeleting(true)
    setDeleteError('')
    try {
      await deleteMe(deletePassword)
      // A conta e a sessão já não existem no servidor — não há logout a chamar.
      clearAuth()
      navigate('/login', { replace: true })
    } catch (err: unknown) {
      setDeleteError(errorDetail(err, 'Não foi possível excluir a conta. Tente novamente.'))
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Resetar Assistente ────────────────────────────────────────────────────
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  async function handleResetAssistant() {
    setIsResetting(true)
    try {
      await clearHistorico()
      setResetModalOpen(false)
      addToast({ message: 'Assistente resetado com sucesso', type: 'success' })
    } catch {
      addToast({ message: 'Erro ao resetar o Assistente. Tente novamente.', type: 'error' })
    } finally {
      setIsResetting(false)
    }
  }

  // ── Exportar transações ───────────────────────────────────────────────────
  // NÃO é backup: /transactions/export traz só transações — sem cartões,
  // parcelas, recorrências nem categorias. O nome do arquivo diz o que ele é.
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    setIsExporting(true)
    setExportError('')
    try {
      const data = await getAllTransactions()
      const date = new Date().toISOString().slice(0, 10)
      downloadJSON(data, `hivvo-transacoes-${date}.json`)
    } catch {
      setExportError('Não foi possível exportar. Tente novamente.')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Categorias ────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading: catsLoading } = useCategories()
  const deleteMutation = useDeleteCategory()

  // Qual tipo o modal "Nova categoria" está criando (a SEÇÃO define o tipo — sem
  // dropdown). null = fechado.
  const [addTipo, setAddTipo] = useState<'receita' | 'despesa' | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // ── Recorrências ──────────────────────────────────────────────────────────
  const { data: recorrencias = [], isLoading: recsLoading } = useRecorrencias()
  const updateRecMutation = useUpdateRecorrencia()
  const deleteRecMutation = useDeleteRecorrencia()
  const corrigirRecMutation = useCorrigirValorRecorrencia()
  const hardDeleteRecMutation = useDeleteRecorrenciaPermanente()

  const [editingRec, setEditingRec] = useState<Recorrencia | null>(null)
  const [recDescricao, setRecDescricao] = useState('')
  const [recValor, setRecValor] = useState('')
  const [recCategoria, setRecCategoria] = useState('')
  const [recDia, setRecDia] = useState('')
  const [recForma, setRecForma] = useState('')
  const [recError, setRecError] = useState('')
  const [deletingRecId, setDeletingRecId] = useState<string | null>(null)
  // Intenção ao mudar o valor (§3.1.2): "alterar" (versionado) vs "corrigir" (erro).
  const [recValorIntent, setRecValorIntent] = useState<'alterar' | 'corrigir'>('alterar')
  // Confirmação do apagar permanentemente (troca o conteúdo do modal de editar).
  const [confirmingHardDelete, setConfirmingHardDelete] = useState(false)

  // Detalhe do rec em edição: precisamos de vigencias.length p/ gating do corrigir.
  const { data: editingDetail } = useRecorrenciaDetail(editingRec?.id ?? null)
  const vigenciasCount = editingDetail?.vigencias.length

  function openEditRec(rec: Recorrencia) {
    setEditingRec(rec)
    setRecDescricao(rec.descricao)
    setRecValor(rec.valor_exibicao ?? '')
    setRecCategoria(rec.categoria)
    setRecDia(String(rec.dia_do_mes))
    setRecForma(rec.forma_pagamento)
    setRecError('')
    setRecValorIntent('alterar')
    setConfirmingHardDelete(false)
  }

  function closeEditRec() {
    setEditingRec(null)
    setConfirmingHardDelete(false)
  }

  // Valor exibido/carregado no campo (o mesmo do prefill) para comparar com o
  // editado. Base = valor_exibicao: p/ início futuro é a vigência futura, então
  // digitar o mesmo valor NÃO conta como mudança (evita versionar à toa).
  const recValorAtual =
    editingRec?.valor_exibicao != null ? Number(editingRec.valor_exibicao) : null
  const recValorNovo = recValor.trim() ? parseFloat(recValor.replace(',', '.')) : NaN
  // Envia valor quando: mudou de um valor conhecido, OU não havia base
  // (só encerrada — o backend substitui in place, sem versionar).
  const recValorChanged =
    !isNaN(recValorNovo) &&
    (recValorAtual == null || recValorNovo.toFixed(2) !== recValorAtual.toFixed(2))
  // "Corrigir valor" só com vigência única (erro fresco — §3.1.2).
  const podeCorrigir = vigenciasCount === 1
  // Metadados mudaram? (para decidir se, no fluxo "corrigir", também vai um PATCH normal)
  const recMetadadosChanged = editingRec
    ? recDescricao.trim() !== editingRec.descricao ||
      recCategoria !== editingRec.categoria ||
      Number(recDia) !== editingRec.dia_do_mes ||
      recForma !== editingRec.forma_pagamento
    : false

  const recSaving = updateRecMutation.isPending || corrigirRecMutation.isPending

  async function handleSaveRec() {
    if (!editingRec) return
    const desc = recDescricao.trim()
    if (desc.length < 2) {
      setRecError('Descrição: mínimo 2 caracteres.')
      return
    }
    const dia = Number(recDia)
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
      setRecError('Dia do mês entre 1 e 31.')
      return
    }
    if (isNaN(recValorNovo) || recValorNovo <= 0) {
      setRecError('Valor deve ser maior que zero.')
      return
    }
    const metaPayload: RecorrenciaUpdate = {
      descricao: desc,
      categoria: recCategoria,
      dia_do_mes: dia,
      forma_pagamento: recForma,
    }

    // Intenção "corrigir" (§3.1.2 — foi erro): reescreve o valor em TODOS os meses.
    // Corrigir PRIMEIRO (é o passo que pode 409): se falhar, nada foi escrito —
    // sem estado parcial nem toast de sucesso competindo. Metadados (se mudaram)
    // vão depois, via PATCH normal.
    if (recValorChanged && recValorIntent === 'corrigir' && podeCorrigir) {
      try {
        await corrigirRecMutation.mutateAsync({ id: editingRec.id, valor: recValorNovo.toFixed(2) })
        if (recMetadadosChanged) {
          await updateRecMutation.mutateAsync({ id: editingRec.id, payload: metaPayload })
        }
        closeEditRec()
      } catch (err: unknown) {
        // 409 (múltiplas vigências) ou outro erro → mensagem explícita de que o
        // valor não foi corrigido, seguida do detalhe do backend (quando houver).
        const detail = (err as { response?: { data?: { detail?: unknown } } })
          ?.response?.data?.detail
        const backend =
          typeof detail === 'string' && detail.trim() ? ` ${detail}` : ''
        addToast({ message: `O valor não foi corrigido.${backend}`, type: 'error' })
      }
      return
    }

    // Intenção normal "alterar" (versionado) + metadados num único PATCH.
    // Metadados retroativos (backend usa exclude_unset); valor só quando muda.
    const payload: RecorrenciaUpdate = { ...metaPayload }
    if (recValorChanged) payload.valor = recValorNovo.toFixed(2)
    updateRecMutation.mutate(
      { id: editingRec.id, payload },
      {
        onSuccess: () => closeEditRec(),
        onError: () => setRecError('Erro ao salvar. Tente novamente.'),
      },
    )
  }

  function handleHardDeleteRec() {
    if (!editingRec) return
    hardDeleteRecMutation.mutate(editingRec.id, {
      onSuccess: () => closeEditRec(),
      onError: () => addToast({ message: 'Erro ao apagar. Tente novamente.', type: 'error' }),
    })
  }

  // Lista de categorias de um tipo (skeleton / vazio / itens com confirmação de
  // remoção). Só custom têm id → só elas mostram o ✕ (padrão vem sem).
  function renderCategoryList(tipo: Category['tipo']) {
    const cats = categories.filter((c) => c.tipo === tipo)
    if (catsLoading) {
      return (
        <div className="flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 rounded-md bg-bg-border animate-pulse" />
          ))}
        </div>
      )
    }
    if (cats.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-sm text-text-muted">Nenhuma categoria disponível.</p>
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-1">
        {cats.map((cat) =>
          deletingId !== null && deletingId === cat.id ? (
            <div
              key={cat.is_padrao ? `padrao:${cat.tipo}:${cat.nome}` : cat.id}
              className="flex items-center justify-between gap-2 px-2 py-2 rounded-md bg-danger/5 border border-danger/30"
            >
              <span className="text-xs text-text-primary truncate">
                Remover <span className="font-medium">{cat.nome}</span>?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDeletingId(null)}
                  className="text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Não
                </button>
                <button
                  onClick={() => {
                    // só categorias custom têm id (padrão = null e sem ✕)
                    if (cat.id == null) return
                    deleteMutation.mutate(cat.id, {
                      onSuccess: () => setDeletingId(null),
                    })
                  }}
                  disabled={deleteMutation.isPending}
                  className="text-xs text-danger hover:text-danger/80 font-medium transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? '…' : 'Sim'}
                </button>
              </div>
            </div>
          ) : (
            <div
              key={cat.is_padrao ? `padrao:${cat.tipo}:${cat.nome}` : cat.id}
              className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-bg-border/50 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none">{cat.icone}</span>
                <span className="text-sm text-text-primary truncate">{cat.nome}</span>
              </div>
              {!cat.is_padrao && (
                <button
                  onClick={() => setDeletingId(cat.id)}
                  className="text-text-muted hover:text-danger transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs shrink-0"
                  aria-label={`Remover ${cat.nome}`}
                >
                  ✕
                </button>
              )}
            </div>
          ),
        )}
      </div>
    )
  }

  // ── Content ───────────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col gap-6">

      {/* ── Categorias (separadas por tipo — cada seção cria o seu tipo) ── */}
      {(['despesa', 'receita'] as const).map((secTipo) => (
        <Section
          key={secTipo}
          title={secTipo === 'despesa' ? 'Categorias de despesa' : 'Categorias de receita'}
        >
          <SettingsRow>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-text-muted">
                {secTipo === 'despesa'
                  ? 'Categorias dos seus gastos.'
                  : 'Categorias dos seus ganhos.'}
              </p>
              <button
                onClick={() => setAddTipo(secTipo)}
                className="text-xs text-amber hover:text-amber-light transition-colors font-medium"
              >
                + Adicionar
              </button>
            </div>
            {renderCategoryList(secTipo)}
          </SettingsRow>
        </Section>
      ))}

      {/* ── Recorrências ── */}
      <Section title="Recorrências">
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Receitas e despesas que se repetem todo mês.
          </p>

          {recsLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-11 rounded-md bg-bg-border animate-pulse" />
              ))}
            </div>
          ) : recorrencias.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-sm text-text-muted">
                Nenhuma recorrência cadastrada. Crie uma ao adicionar um lançamento recorrente.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {recorrencias.map((rec) =>
                deletingRecId === rec.id ? (
                  <div
                    key={rec.id}
                    className="flex flex-col gap-2 px-3 py-2.5 rounded-md bg-danger/5 border border-danger/30"
                  >
                    <p className="text-xs text-text-primary">
                      Encerrar <span className="font-medium">{rec.descricao}</span>?
                    </p>
                    <p className="text-xs text-text-muted">
                      Encerrar mantém o histórico e para de gerar a partir deste mês. Se esta recorrência foi criada por engano e você quer removê-la completamente (inclusive do passado), use Editar → Apagar permanentemente.
                    </p>
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => setDeletingRecId(null)}
                        className="text-xs text-text-muted hover:text-text-primary transition-colors"
                      >
                        Não
                      </button>
                      <button
                        onClick={() =>
                          deleteRecMutation.mutate(rec.id, {
                            onSuccess: () => setDeletingRecId(null),
                          })
                        }
                        disabled={deleteRecMutation.isPending}
                        className="text-xs text-danger hover:text-danger/80 font-medium transition-colors disabled:opacity-50"
                      >
                        {deleteRecMutation.isPending ? '…' : 'Sim, encerrar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover:bg-bg-border/50 transition-colors group"
                  >
                    <button
                      onClick={() => openEditRec(rec)}
                      className="flex flex-col min-w-0 text-left flex-1"
                    >
                      <span className="text-sm text-text-primary truncate">
                        {rec.descricao} ·{' '}
                        <span className={rec.tipo === 'receita' ? 'text-success' : 'text-danger'}>
                          {rec.valor_exibicao != null
                            ? rec.mes_exibicao != null && rec.ano_exibicao != null
                              ? `${formatBRL(Number(rec.valor_exibicao))}/mês · a partir de ${MONTHS_SHORT[rec.mes_exibicao - 1]}/${rec.ano_exibicao}`
                              : `${formatBRL(Number(rec.valor_exibicao))}/mês`
                            : '—'}
                        </span>
                      </span>
                      <span className="text-xs text-text-muted">
                        {rec.tipo === 'receita' ? 'Receita' : 'Despesa'} · todo dia {rec.dia_do_mes}
                      </span>
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEditRec(rec)}
                        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg-border transition-colors text-sm"
                        aria-label={`Editar ${rec.descricao}`}
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => setDeletingRecId(rec.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-text-muted hover:text-danger hover:bg-bg-border transition-colors text-xs"
                        aria-label={`Encerrar ${rec.descricao}`}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </SettingsRow>
      </Section>

      {/* ── Assistente IA ── */}
      <Section title="Assistente IA">
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Apaga todo o histórico de conversas com o Assistente. Na próxima conversa, a IA não terá memória das interações anteriores e se apresentará como se fosse o primeiro acesso.
          </p>
          <Button variant="danger" onClick={() => setResetModalOpen(true)}>
            Resetar Assistente
          </Button>
        </SettingsRow>
      </Section>

      {/* ── Meus dados: entrada · saída · eliminação (a natureza LGPD) ── */}
      <Section title="Meus dados">
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Importe transações a partir de um arquivo CSV.
          </p>
          <Button variant="ghost" onClick={() => navigate('/import')}>
            ↑ Importar CSV
          </Button>
        </SettingsRow>

        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Importe a fatura de um cartão de crédito em PDF. Revise as despesas e as categorias
            antes de confirmar.
          </p>
          <Button variant="ghost" onClick={() => navigate('/import/fatura')}>
            ↑ Importar fatura (PDF)
          </Button>
        </SettingsRow>

        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Importe o extrato da sua conta em PDF. Receitas, débitos e pagamentos de fatura
            são revisados antes de confirmar.
          </p>
          <Button variant="ghost" onClick={() => navigate('/import/extrato')}>
            ↑ Importar extrato (PDF)
          </Button>
        </SettingsRow>

        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Baixa um arquivo JSON com as suas transações. Não inclui cartões, parcelas,
            recorrências nem categorias — não é um backup da conta.
          </p>
          <Button variant="ghost" isLoading={isExporting} onClick={handleExport}>
            {isExporting ? 'Exportando…' : '↓ Exportar transações (JSON)'}
          </Button>
          {exportError && (
            <p className="mt-2 text-xs text-danger">{exportError}</p>
          )}
        </SettingsRow>

        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Apaga os seus lançamentos e recomeça com a conta vazia. Você continua logado e as
            suas categorias são mantidas. Esta ação é irreversível.
          </p>
          <Button variant="danger" onClick={() => setResetDataModalOpen(true)}>
            Começar do zero
          </Button>
        </SettingsRow>

        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Apaga a sua conta e todos os seus dados. Esta ação é irreversível.
          </p>
          <Button variant="danger" onClick={() => setDeleteModalOpen(true)}>
            Excluir minha conta
          </Button>
        </SettingsRow>
      </Section>

      {/* ── Sobre ── */}
      {/* A versão sai do build (vite.config), não do backend: o /openapi.json
          está desativado em produção e o /health é genérico de propósito. */}
      <Section title="Sobre">
        <SettingsRow>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-text-muted">Versão</span>
            <span className="text-sm text-text-primary tabular-nums">
              {import.meta.env.VITE_APP_VERSION}
            </span>
          </div>
        </SettingsRow>
        <SettingsRow>
          <p className="text-sm text-text-muted mb-3">
            Encontrou um problema ou tem uma sugestão? Escreva para a gente — informe a versão
            acima, ajuda a investigar.
          </p>
          <a
            href="mailto:contato@hivvo.app"
            className="inline-flex items-center text-sm text-amber hover:text-amber-light transition-colors"
          >
            contato@hivvo.app
          </a>
        </SettingsRow>
      </Section>

    </div>
  )

  const addModal = addTipo && (
    <NewCategoryModal
      tipo={addTipo}
      existingNames={categories
        .filter((c) => c.tipo === addTipo)
        .map((c) => c.nome)}
      onClose={() => setAddTipo(null)}
    />
  )

  const editRecModal = editingRec && (() => {
    const catNames = categories
      .filter((c) => c.ativa && c.tipo === editingRec.tipo)
      .map((c) => c.nome)
    const catOptions = catNames.includes(recCategoria) ? catNames : [recCategoria, ...catNames]
    const formaOptions = FORMAS_RECORRENCIA.includes(recForma)
      ? FORMAS_RECORRENCIA
      : [recForma, ...FORMAS_RECORRENCIA]

    // ── Confirmação do apagar permanentemente (troca o conteúdo do modal) ──
    if (confirmingHardDelete) {
      return (
        <Modal
          title="Apagar permanentemente?"
          onClose={closeEditRec}
          footer={
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmingHardDelete(false)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                isLoading={hardDeleteRecMutation.isPending}
                onClick={handleHardDeleteRec}
              >
                Apagar permanentemente
              </Button>
            </div>
          }
        >
          <p className="text-sm text-text-muted leading-relaxed">
            Isto remove a recorrência e todo o histórico dela, inclusive de meses passados. Use apenas se foi criada por engano. Esta ação não pode ser desfeita.
          </p>
        </Modal>
      )
    }

    return (
      <Modal
        title="Editar recorrência"
        onClose={closeEditRec}
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setConfirmingHardDelete(true)}
              className="text-xs text-danger hover:text-danger/80 transition-colors"
            >
              Apagar permanentemente
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={closeEditRec}>
                Cancelar
              </Button>
              <Button isLoading={recSaving} onClick={handleSaveRec}>
                Salvar
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-descricao">Descrição</label>
            <input
              id="rec-descricao"
              type="text"
              value={recDescricao}
              onChange={(e) => {
                setRecDescricao(e.target.value)
                if (recError) setRecError('')
              }}
              className={recFieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-valor">Valor (R$)</label>
            <input
              id="rec-valor"
              type="number"
              step="0.01"
              min="0.01"
              value={recValor}
              onChange={(e) => {
                setRecValor(e.target.value)
                if (recError) setRecError('')
              }}
              className={recFieldClass}
            />
            {recValorChanged && (
              <div className="flex flex-col gap-1.5 mt-0.5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={recValorIntent === 'alterar'}
                    onChange={() => setRecValorIntent('alterar')}
                    className="accent-amber mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="text-xs text-text-primary">Alterar valor</span>
                    <span className="text-xs text-text-muted">
                      A partir deste mês. Os meses anteriores mantêm o valor anterior.
                    </span>
                  </span>
                </label>
                {podeCorrigir && (
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={recValorIntent === 'corrigir'}
                      onChange={() => setRecValorIntent('corrigir')}
                      className="accent-amber mt-0.5"
                    />
                    <span className="flex flex-col">
                      <span className="text-xs text-text-primary">Corrigir valor</span>
                      <span className="text-xs text-text-muted">
                        Foi erro de digitação. Aplica a todos os meses, inclusive passados.
                      </span>
                    </span>
                  </label>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-categoria">Categoria</label>
            <select
              id="rec-categoria"
              value={recCategoria}
              onChange={(e) => setRecCategoria(e.target.value)}
              className={recFieldClass}
            >
              {catOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-dia">Dia do mês</label>
            <input
              id="rec-dia"
              type="number"
              min="1"
              max="31"
              value={recDia}
              onChange={(e) => {
                setRecDia(e.target.value)
                if (recError) setRecError('')
              }}
              className={recFieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-muted" htmlFor="rec-forma">Forma de pagamento</label>
            <select
              id="rec-forma"
              value={recForma}
              onChange={(e) => setRecForma(e.target.value)}
              className={recFieldClass}
            >
              {formaOptions.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {recError && <p className="text-xs text-danger">{recError}</p>}
        </div>
      </Modal>
    )
  })()

  const resetModal = resetModalOpen && (
    <Modal
      title="Resetar Assistente?"
      onClose={() => setResetModalOpen(false)}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setResetModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" isLoading={isResetting} onClick={handleResetAssistant}>
            Resetar
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted leading-relaxed">
        Esta ação apagará todo o histórico de conversas com a IA. Ela não terá mais memória das suas interações anteriores. Esta ação é irreversível.
      </p>
    </Modal>
  )

  // Dois estados: pedir a senha e, depois do 200, virar o recibo. O recibo é o
  // motivo de a rota responder 200 e não 204 — um toast some em segundos e
  // trunca as linhas; o usuário já está olhando para o modal.
  const resetDataModal = resetDataModalOpen && (
    resetDataRecibo ? (
      (() => {
        const linhas = linhasDoRecibo(resetDataRecibo)
        return (
          <Modal
            title="Pronto — sua conta está zerada"
            onClose={closeResetDataModal}
            footer={<Button onClick={closeResetDataModal}>Fechar</Button>}
          >
            <div className="flex flex-col gap-3">
              {linhas.length === 0 ? (
                <p className="text-sm text-text-muted leading-relaxed">
                  Não havia dados para apagar — a sua conta já estava vazia.
                </p>
              ) : (
                <>
                  <p className="text-sm text-text-muted">Apagamos:</p>
                  <ul className="flex flex-col gap-1">
                    {linhas.map((linha) => (
                      <li key={linha} className="text-sm text-text-primary">
                        · {linha}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xs text-text-muted leading-relaxed">
                Suas categorias e a sua conta continuam como estavam.
              </p>
            </div>
          </Modal>
        )
      })()
    ) : (
      <Modal
        title="Começar do zero?"
        onClose={closeResetDataModal}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeResetDataModal}>
              Cancelar
            </Button>
            <Button variant="danger" isLoading={isResettingData} onClick={handleResetData}>
              Apagar meus dados
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted leading-relaxed">
            Isto apaga as suas transações, parcelas, cartões, faturas e pagamentos,
            recorrências e o histórico do Assistente. Não há como desfazer.
          </p>
          <p className="text-sm text-text-muted leading-relaxed">
            <span className="text-text-primary">O que fica:</span> a sua conta (você continua
            logado) e as suas categorias personalizadas.
          </p>
          <Input
            id="reset-data-password"
            label="Digite sua senha para confirmar"
            type="password"
            autoComplete="current-password"
            showToggle
            value={resetDataPassword}
            onChange={(e) => {
              setResetDataPassword(e.target.value)
              if (resetDataError) setResetDataError('')
            }}
            error={resetDataError}
          />
        </div>
      </Modal>
    )
  )

  const deleteModal = deleteModalOpen && (
    <Modal
      title="Excluir minha conta?"
      onClose={closeDeleteModal}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={closeDeleteModal}>
            Cancelar
          </Button>
          <Button variant="danger" isLoading={isDeleting} onClick={handleDeleteAccount}>
            Excluir permanentemente
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted leading-relaxed">
          Isto apaga a sua conta e TODOS os seus dados — transações, cartões, parcelas,
          recorrências, categorias e o histórico do Assistente. Não há como desfazer nem
          recuperar depois.
        </p>
        <Input
          id="delete-password"
          label="Digite sua senha para confirmar"
          type="password"
          autoComplete="current-password"
          showToggle
          value={deletePassword}
          onChange={(e) => {
            setDeletePassword(e.target.value)
            if (deleteError) setDeleteError('')
          }}
          error={deleteError}
        />
      </div>
    </Modal>
  )

  if (isMobile) {
    return (
      <>
        {addModal}
        {editRecModal}
        {resetDataModal}
        {deleteModal}
        {resetModal}
        <div className="flex flex-col h-full">
          <header className="shrink-0 flex items-center gap-3 px-4 h-14 border-b border-bg-border bg-bg-surface">
            <button
              onClick={() => navigate(-1)}
              className="text-text-muted hover:text-text-primary text-lg leading-none transition-colors"
              aria-label="Voltar"
            >
              ←
            </button>
            <h1 className="text-sm font-medium text-text-primary">Configurações</h1>
          </header>
          <main className="flex-1 overflow-y-auto p-4">{content}</main>
        </div>
      </>
    )
  }

  return (
    <>
      {addModal}
      {editRecModal}
      {resetDataModal}
      {deleteModal}
      {resetModal}
      <div className="p-6 max-w-xl mx-auto">
        <h1 className="text-[22px] font-medium tracking-tight text-text-primary mb-6">
          Configurações
        </h1>
        {content}
      </div>
    </>
  )
}
