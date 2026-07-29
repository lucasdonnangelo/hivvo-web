import { useEffect, useMemo } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import type { Card, CardPayload } from '../../services/cards'

// Espelha a mensagem do backend (app/schemas/card.py:
// MSG_VENCIMENTO_ANTES_DO_FECHAMENTO) — validar aqui evita o round-trip e o 422,
// mas a regra continua sendo do servidor. Constante para o render poder
// reconhecer ESTE erro e exibi-lo fora da célula estreita da grade.
const MSG_VENCIMENTO_ANTES_DO_FECHAMENTO =
  'Vence antes de fechar — no mesmo mês, o vencimento tem que ser depois do ' +
  "fechamento. Se vence no mês seguinte, escolha 'Mês seguinte ao fechamento'."

// Schema por instância: só o cruzamento fechamento×vencimento depende de
// `locked` (ver a nota no final do superRefine).
const makeSchema = (locked: boolean) =>
  z
    .object({
      nome: z.string().min(1, 'Nome obrigatório').max(40),
      // Limite é OPCIONAL (cartões premium/black podem não ter limite pré-definido;
      // o backend aceita null). `preprocess` mapeia campo vazio '' → undefined ANTES
      // do coerce — sem isso, z.coerce.number('') viraria 0 e enviaria 0 em vez de null.
      limite: z.preprocess(
        (v) => (v === '' || v === undefined || v === null ? undefined : v),
        z.coerce.number().optional(),
      ),
      tipo: z.enum(['Crédito', 'Débito', 'Ambos']),
      dia_fechamento: z.coerce.number().int().optional(),
      dia_vencimento: z.coerce.number().int().optional(),
      mes_offset_vencimento: z.coerce.number().int().optional(),
    })
    // Débito não tem fatura: limite / dias / offset não são exigidos.
    // Para Crédito e Ambos, os DIAS continuam obrigatórios; o LIMITE é opcional
    // (só validado quando preenchido).
    .superRefine((val, ctx) => {
      if (val.tipo === 'Débito') return

      // Limite opcional: vazio (undefined) passa; se preenchido, precisa ser > 0.
      if (val.limite !== undefined && !isNaN(val.limite) && val.limite <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['limite'], message: 'Informe um limite válido' })
      }

      if (val.dia_fechamento === undefined || isNaN(val.dia_fechamento)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_fechamento'], message: 'Obrigatório' })
      } else if (val.dia_fechamento < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_fechamento'], message: 'Mín. 1' })
      } else if (val.dia_fechamento > 28) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_fechamento'], message: 'Máx. 28' })
      }

      if (val.dia_vencimento === undefined || isNaN(val.dia_vencimento)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_vencimento'], message: 'Obrigatório' })
      } else if (val.dia_vencimento < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_vencimento'], message: 'Mín. 1' })
      } else if (val.dia_vencimento > 28) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dia_vencimento'], message: 'Máx. 28' })
      }

      if (
        val.mes_offset_vencimento === undefined ||
        isNaN(val.mes_offset_vencimento) ||
        val.mes_offset_vencimento < 0 ||
        val.mes_offset_vencimento > 1
      ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mes_offset_vencimento'], message: 'Inválido' })
      }

      // CRUZAMENTO fechamento×vencimento (espelha fechamento_vencimento_coerentes
      // do backend): com "mesmo mês" (offset 0) a fatura não pode vencer antes de —
      // nem no mesmo dia que — fechar. Com "mês seguinte" (offset 1) o mês virou
      // entre fechar e vencer, então qualquer par vale. Só roda com os dois dias já
      // presentes: faltando um, o "Obrigatório" acima é que fala.
      //
      // `locked` (cartão COM compras) desliga a regra: os três campos estão em
      // somente-leitura, então um cartão pré-existente inválido (nascido antes
      // desta regra) travaria a edição do NOME num erro impossível de corrigir na
      // tela. É o mesmo carve-out do backend, que só valida quando o update TOCA
      // esses campos (routers/cards.py; borda registrada em PENDENCIAS #34).
      if (
        !locked &&
        val.mes_offset_vencimento === 0 &&
        val.dia_fechamento !== undefined &&
        !isNaN(val.dia_fechamento) &&
        val.dia_vencimento !== undefined &&
        !isNaN(val.dia_vencimento) &&
        val.dia_vencimento <= val.dia_fechamento
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dia_vencimento'],
          message: MSG_VENCIMENTO_ANTES_DO_FECHAMENTO,
        })
      }
    })

type FormValues = z.infer<ReturnType<typeof makeSchema>>

interface CardFormModalProps {
  card?: Card
  onSave: (payload: CardPayload) => void
  onClose: () => void
  isLoading: boolean
}

export default function CardFormModal({ card, onSave, onClose, isLoading }: CardFormModalProps) {
  const isEdit = !!card

  // Cartão em edição COM compras: o backend rejeita (422) mudar
  // fechamento/vencimento/offset (corromperia o fatura_mes já materializado). A UI
  // trava os três campos em somente-leitura — o usuário consulta mas não edita.
  // Criação nunca trava (não há compras ainda). Mantê-los readOnly/CSS-lock (não
  // `disabled` nativo) preserva o valor no react-hook-form: a validação passa e o
  // payload reenvia o valor ATUAL, sem disparar um 422 auto-infligido.
  const locked = isEdit && !!card?.tem_lancamentos
  const lockClass = locked ? 'opacity-60 cursor-not-allowed' : ''

  // `locked` não muda enquanto o modal vive (sai do cartão que o abriu), então o
  // resolver é estável na prática — o memo só evita recriar o schema a cada render.
  const schema = useMemo(() => makeSchema(locked), [locked])

  const {
    register,
    handleSubmit,
    reset,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    mode: 'onChange',
    defaultValues: {
      nome: '',
      limite: undefined,
      tipo: 'Crédito',
      // Sem default de dia: campos VAZIOS obrigam o usuário a preencher com os
      // dados reais do cartão. Um default plausível-mas-errado (1/10) passaria sem
      // conferência e jogaria TODAS as faturas — e a projeção — no mês errado.
      dia_fechamento: undefined,
      dia_vencimento: undefined,
      mes_offset_vencimento: 0,
    },
  })

  const tipo = watch('tipo')
  const isDebito = tipo === 'Débito'
  // Identifica o erro CRUZADO pela mensagem (a constante é a fonte única, tanto
  // do addIssue quanto daqui) para renderizá-lo fora da célula da grade.
  const erroCruzado = errors.dia_vencimento?.message === MSG_VENCIMENTO_ANTES_DO_FECHAMENTO

  useEffect(() => {
    if (card) {
      reset({
        nome: card.nome,
        limite: card.limite != null ? parseFloat(card.limite) : undefined,
        tipo: card.tipo,
        dia_fechamento: card.dia_fechamento,
        dia_vencimento: card.dia_vencimento,
        mes_offset_vencimento: card.mes_offset_vencimento,
      })
    }
  }, [card, reset])

  // Ao alternar para Débito, limpa erros dos campos de fatura (ocultos)
  // para não travar o submit com erro de campo que não aparece mais.
  useEffect(() => {
    if (isDebito) {
      clearErrors(['limite', 'dia_fechamento', 'dia_vencimento', 'mes_offset_vencimento'])
    }
  }, [isDebito, clearErrors])

  const onSubmit = (values: FormValues) => {
    const debito = values.tipo === 'Débito'
    onSave({
      nome: values.nome,
      tipo: values.tipo,
      limite: debito ? null : (values.limite ?? null),
      dia_fechamento: debito ? null : (values.dia_fechamento ?? null),
      dia_vencimento: debito ? null : (values.dia_vencimento ?? null),
      mes_offset_vencimento: debito ? null : (values.mes_offset_vencimento ?? null),
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
          {/* Botão SEMPRE clicável (só trava durante o submit). A validação roda no
              clique via handleSubmit: campos inválidos ganham erro inline e o RHF
              foca o primeiro — nunca uma trava silenciosa (mesmo padrão do
              AddTransactionPage). */}
          <Button
            className="flex-1"
            onClick={handleSubmit(onSubmit)}
            isLoading={isLoading}
            disabled={isLoading}
          >
            {isEdit ? 'Salvar' : 'Adicionar'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Nome do cartão" error={errors.nome?.message} {...register('nome')} />

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

        {/* Campos de fatura: só para cartões com crédito (Crédito / Ambos). Débito não tem fatura. */}
        {!isDebito && (
          <>
            <Input
              label="Limite (R$) — opcional"
              type="number"
              step="0.01"
              min="0"
              placeholder="Deixe vazio se não houver limite"
              error={errors.limite?.message}
              {...register('limite')}
            />

            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Dia fechamento"
                  type="number"
                  min="1"
                  max="28"
                  readOnly={locked}
                  className={lockClass}
                  error={errors.dia_fechamento?.message}
                  {...register('dia_fechamento')}
                />
                <Input
                  label="Dia vencimento"
                  type="number"
                  min="1"
                  max="28"
                  readOnly={locked}
                  className={lockClass}
                  // O erro CRUZADO não cabe na coluna (metade da largura do modal):
                  // o campo fica só marcado em vermelho e o texto vai inteiro
                  // abaixo da grade. Os erros curtos ("Obrigatório", "Máx. 28")
                  // seguem dentro da célula, como antes.
                  error={erroCruzado ? undefined : errors.dia_vencimento?.message}
                  invalid={erroCruzado}
                  {...register('dia_vencimento')}
                />
              </div>
              {erroCruzado ? (
                <p className="text-xs text-danger">{MSG_VENCIMENTO_ANTES_DO_FECHAMENTO}</p>
              ) : (
                !locked && (
                  <p className="text-xs text-text-muted">Confira na fatura do seu cartão.</p>
                )
              )}
            </div>

            {/* mes_offset */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-muted">Vencimento da fatura</label>
              {/* Locked: bloqueia interação sem `disabled` nativo (que faria o RHF
                  descartar o valor) — pointer-events + tabIndex/aria mantêm o valor
                  atual registrado e válido no submit. */}
              <select
                {...register('mes_offset_vencimento')}
                tabIndex={locked ? -1 : undefined}
                aria-disabled={locked || undefined}
                className={[
                  'w-full px-3 py-2 rounded-md text-sm text-text-primary bg-bg-surface border border-bg-border focus:outline-none focus:border-amber transition-colors',
                  locked ? `pointer-events-none ${lockClass}` : '',
                ].join(' ')}
              >
                <option value={0}>Mesmo mês do fechamento</option>
                <option value={1}>Mês seguinte ao fechamento</option>
              </select>
              {errors.mes_offset_vencimento && (
                <p className="text-xs text-danger">{errors.mes_offset_vencimento.message}</p>
              )}
            </div>

            {locked && (
              <p className="text-xs text-text-muted bg-bg-surface rounded-md px-3 py-2 border border-bg-border">
                Para alterar o fechamento ou vencimento, crie um novo cartão. As compras já lançadas
                dependem destas datas.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
