import { useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useCreateCategory } from '../../hooks/useCategories'
import type { Category } from '../../services/categories'

const QUICK_EMOJIS = ['🍔','🚗','🏠','💊','📚','🎮','👕','📱','✈️','🐾','💰','💻','📈','🎯','📦']

// Separa o emoji líder do nome ("🐾 Pets" → { icone: '🐾', nome: 'Pets' });
// sem emoji cai no 📦 padrão.
function extractEmojiAndName(text: string): { icone: string; nome: string } {
  if (!text) return { icone: '📦', nome: '' }
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  const [first] = seg.segment(text)
  if (first && /\p{Extended_Pictographic}/u.test(first.segment)) {
    return { icone: first.segment, nome: text.slice(first.segment.length).trim() }
  }
  return { icone: '📦', nome: text }
}

interface NewCategoryModalProps {
  // O tipo é DEFINIDO pelo contexto (seção em Configurações ou tipo da transação),
  // nunca escolhido aqui — por isso não há dropdown de tipo.
  tipo: 'receita' | 'despesa'
  // Nomes já existentes do MESMO tipo, para checar duplicata (o "Outros" de
  // despesa e o de receita coexistem — a checagem é por tipo).
  existingNames: string[]
  onClose: () => void
  onCreated?: (cat: Category) => void
}

export default function NewCategoryModal({
  tipo,
  existingNames,
  onClose,
  onCreated,
}: NewCategoryModalProps) {
  const isMobile = useBreakpoint('md')
  const createMutation = useCreateCategory()
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const tipoLabel = tipo === 'despesa' ? 'despesa' : 'receita'

  function submit() {
    const { icone, nome } = extractEmojiAndName(name.trim())
    if (nome.length < 2) {
      setError('Mínimo 2 caracteres no nome.')
      return
    }
    if (existingNames.some((n) => n.toLowerCase() === nome.toLowerCase())) {
      setError('Já existe uma categoria com esse nome.')
      return
    }
    createMutation.mutate(
      { nome, icone, tipo },
      {
        onSuccess: (cat) => {
          onCreated?.(cat)
          onClose()
        },
        onError: () => setError('Erro ao criar. Tente novamente.'),
      },
    )
  }

  return (
    <Modal
      title="Nova categoria"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button isLoading={createMutation.isPending} onClick={submit}>
            Adicionar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        <p className="text-xs text-text-muted">
          Será criada como{' '}
          <span className={tipo === 'despesa' ? 'text-danger' : 'text-success'}>
            {tipoLabel}
          </span>
          .
        </p>
        <label className="text-xs text-text-muted" htmlFor="cat-name">
          Nome
        </label>
        <input
          id="cat-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          placeholder="Ex: 🐾 Pets"
          autoFocus
          className={`w-full rounded-md bg-bg border px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-amber transition-colors ${
            error ? 'border-danger' : 'border-bg-border'
          }`}
        />
        {!isMobile && (
          <div className="flex flex-wrap gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setName((prev) =>
                    emoji + ' ' + prev.replace(/^\p{Extended_Pictographic}\s*/u, ''),
                  )
                  setError('')
                }}
                className="text-base leading-none p-1 rounded hover:bg-bg-border transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
