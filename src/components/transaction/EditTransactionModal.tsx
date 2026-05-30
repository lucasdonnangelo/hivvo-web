import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import type { Transaction } from '../../services/transactions'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'

const FORMAS_PAGAMENTO = ['Débito', 'Crédito', 'PIX', 'Dinheiro', 'TED/DOC']

const selectClass =
  'w-full px-3 py-3 rounded-sm text-sm text-text-primary bg-bg-surface border border-bg-border focus:outline-none focus:border-amber transition-colors'

const schema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  descricao: z.string().min(1, 'Campo obrigatório'),
  valor: z.coerce
    .number()
    .refine(v => !isNaN(v), { message: 'Valor inválido' })
    .refine(v => v > 0, { message: 'Deve ser maior que zero' }),
  categoria: z.string().min(1, 'Campo obrigatório'),
  data: z.string().min(1, 'Campo obrigatório'),
  forma_pagamento: z.string().min(1, 'Campo obrigatório'),
})

type FormData = z.infer<typeof schema>

interface Props {
  tx: Transaction
  categories: string[]
  onSave: (id: number, payload: Partial<Omit<Transaction, 'id'>>) => void
  onClose: () => void
  isLoading: boolean
}

export default function EditTransactionModal({
  tx,
  categories,
  onSave,
  onClose,
  isLoading,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema) as Resolver<z.infer<typeof schema>>,
    mode: 'onChange',
    defaultValues: {
      tipo: tx.tipo,
      descricao: tx.descricao,
      valor: parseFloat(tx.valor),
      categoria: tx.categoria,
      data: tx.data,
      forma_pagamento: tx.forma_pagamento,
    },
  })

  const onSubmit = (data: FormData) => {
    onSave(tx.id, { ...data, valor: data.valor.toFixed(2) })
  }

  // Ajuste aprovado: transação parcelada exibe aviso, sem campos editáveis e sem botão salvar
  if (tx.parcelado) {
    return (
      <Modal title="Editar transação" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <div className="rounded-md bg-amber/10 border border-amber/30 px-4 py-3">
            <p className="text-sm font-medium text-amber">Transação parcelada</p>
            <p className="text-xs text-text-muted mt-1">
              Esta é uma transação parcelada. Para editar as parcelas, acesse{' '}
              <span className="text-text-primary">Gerenciar Parcelas</span>.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-text-muted mb-1">Descrição</p>
              <p className="text-sm text-text-primary">{tx.descricao}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-text-muted mb-1">Valor</p>
                <p className="text-sm text-text-primary">
                  R$ {parseFloat(tx.valor).toFixed(2).replace('.', ',')}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-1">Categoria</p>
                <p className="text-sm text-text-primary">{tx.categoria}</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Editar transação"
      onClose={onClose}
      footer={
        <Button onClick={handleSubmit(onSubmit)} isLoading={isLoading}>
          Salvar alterações
        </Button>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Tipo */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Tipo</label>
          <div className="flex gap-4">
            {(['receita', 'despesa'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" value={t} {...register('tipo')} className="accent-amber" />
                <span className="text-sm text-text-primary capitalize">{t}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Descrição */}
        <Input label="Descrição" error={errors.descricao?.message} {...register('descricao')} />

        {/* Valor */}
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          min="0.01"
          error={errors.valor?.message}
          {...register('valor')}
        />

        {/* Categoria */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Categoria</label>
          <select {...register('categoria')} className={selectClass}>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {errors.categoria && (
            <p className="text-xs text-danger">{errors.categoria.message}</p>
          )}
        </div>

        {/* Data */}
        <Input label="Data" type="date" error={errors.data?.message} {...register('data')} />

        {/* Forma de pagamento */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-text-muted">Forma de pagamento</label>
          <select {...register('forma_pagamento')} className={selectClass}>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          {errors.forma_pagamento && (
            <p className="text-xs text-danger">{errors.forma_pagamento.message}</p>
          )}
        </div>
      </form>
    </Modal>
  )
}
