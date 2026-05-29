import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Spinner from '../ui/Spinner'
import type { Transaction } from '../../services/transactions'

interface Props {
  tx: Transaction
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}

export default function DeleteConfirmModal({ tx, onConfirm, onCancel, isLoading }: Props) {
  return (
    <Modal
      title="Excluir transação"
      onClose={onCancel}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading} className="flex-1">
            Cancelar
          </Button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium bg-danger text-text-primary hover:opacity-90 active:opacity-80 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Spinner size={16} /> : 'Excluir'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">
          Tem certeza que deseja excluir{' '}
          <span className="text-text-primary font-medium">"{tx.descricao}"</span>?
        </p>
        <p className="text-xs text-text-muted">Esta ação não pode ser desfeita.</p>
      </div>
    </Modal>
  )
}
