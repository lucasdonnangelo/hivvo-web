import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import type { Card, CardPayload } from '../../services/cards'

const schema = z.object({
  nome: z.string().min(1, 'Nome obrigatório').max(40),
  limite: z.coerce.number({ invalid_type_error: 'Valor inválido' }).positive('Informe um limite'),
  tipo: z.enum(['Crédito', 'Débito', 'Ambos']),
  dia_fechamento: z.coerce
    .number()
    .int()
    .min(1, 'Mín. 1')
    .max(28, 'Máx. 28'),
  dia_vencimento: z.coerce
    .number()
    .int()
    .min(1, 'Mín. 1')
    .max(28, 'Máx. 28'),
  mes_offset_vencimento: z.coerce.number().int().min(0).max(1),
})

type FormValues = z.infer<typeof schema>

interface CardFormModalProps {
  card?: Card
  onSave: (payload: CardPayload) => void
  onClose: () => void
  isLoading: boolean
}

export default function CardFormModal({ card, onSave, onClose, isLoading }: CardFormModalProps) {
  const isEdit = !!card

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      nome: '',
      limite: undefined,
      tipo: 'Crédito',
      dia_fechamento: 1,
      dia_vencimento: 10,
      mes_offset_vencimento: 0,
    },
  })

  useEffect(() => {
    if (card) {
      reset({
        nome: card.nome,
        limite: parseFloat(card.limite),
        tipo: card.tipo,
        dia_fechamento: card.dia_fechamento,
        dia_vencimento: card.dia_vencimento,
        mes_offset_vencimento: card.mes_offset_vencimento,
      })
    }
  }, [card, reset])

  const onSubmit = (values: FormValues) => {
    onSave({
      nome: values.nome,
      limite: values.limite,
      tipo: values.tipo,
      dia_fechamento: values.dia_fechamento,
      dia_vencimento: values.dia_vencimento,
      mes_offset_vencimento: values.mes_offset_vencimento,
    })
  }

  return (
    <Modal
      title={isEdit ? 'Editar cartão' : 'Adicionar cartão'}
      onClose={onClose}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit(onSubmit)}
            isLoading={isLoading}
            disabled={!isValid || isLoading}
          >
            {isEdit ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Nome do cartão" error={errors.nome?.message} {...register('nome')} />

        <Input
          label="Limite (R$)"
          type="number"
          step="0.01"
          min="0"
          error={errors.limite?.message}
          {...register('limite')}
        />

        {/* Tipo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Tipo</label>
          <select
            {...register('tipo')}
            className="w-full px-3 py-2 rounded-md text-sm text-text-primary bg-bg-surface border border-bg-border focus:outline-none focus:border-amber transition-colors"
          >
            <option value="Crédito">Crédito</option>
            <option value="Débito">Débito</option>
            <option value="Ambos">Crédito e Débito</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Dia fechamento"
            type="number"
            min="1"
            max="28"
            error={errors.dia_fechamento?.message}
            {...register('dia_fechamento')}
          />
          <Input
            label="Dia vencimento"
            type="number"
            min="1"
            max="28"
            error={errors.dia_vencimento?.message}
            {...register('dia_vencimento')}
          />
        </div>

        {/* mes_offset */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-muted">Vencimento da fatura</label>
          <select
            {...register('mes_offset_vencimento')}
            className="w-full px-3 py-2 rounded-md text-sm text-text-primary bg-bg-surface border border-bg-border focus:outline-none focus:border-amber transition-colors"
          >
            <option value={0}>Mesmo mês do fechamento</option>
            <option value={1}>Mês seguinte ao fechamento</option>
          </select>
          {errors.mes_offset_vencimento && (
            <p className="text-xs text-danger">{errors.mes_offset_vencimento.message}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
