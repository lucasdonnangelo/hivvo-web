import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { useMonthlyStats } from '../../hooks/useStatistics'
import { sendMessage } from '../../services/ai'

// ─── types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
}

// ─── constants ────────────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
  'Como estão meus gastos este mês?',
  'Onde posso economizar?',
  'Qual minha maior despesa?',
  'Minhas assinaturas ativas',
]

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// ─── helpers ──────────────────────────────────────────────────────────────────

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function currentMonthYear() {
  const now = new Date()
  return { mes: now.getMonth() + 1, ano: now.getFullYear() }
}

// ─── typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 max-w-[80%]">
      <div className="w-7 h-7 rounded-full bg-amber/20 flex items-center justify-center shrink-0">
        <span className="text-amber text-xs">✦</span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-bg-surface border border-bg-border">
        <div className="flex items-center gap-1">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-amber/20 flex items-center justify-center shrink-0">
          <span className="text-amber text-xs">✦</span>
        </div>
      )}
      <div
        className={[
          'max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed break-words',
          isUser
            ? 'rounded-br-sm bg-amber/15 border border-amber/30 text-text-primary whitespace-pre-wrap'
            : 'rounded-bl-sm bg-bg-surface border border-bg-border text-text-primary',
        ].join(' ')}
      >
        {isUser ? msg.text : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li>{children}</li>,
              h1: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
              h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
              h3: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
            }}
          >
            {msg.text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}

// ─── empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  onSelect,
  isMobile,
}: {
  onSelect: (q: string) => void
  isMobile: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
      <div className="w-14 h-14 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center mb-4">
        <span className="text-amber text-2xl">✦</span>
      </div>
      <p className="text-text-primary font-medium mb-1">Assistente BeeFree</p>
      <p className="text-text-muted text-sm mb-6">
        Pergunte sobre seus gastos, economias e finanças do mês.
      </p>
      {isMobile && (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onSelect(q)}
              className="text-left px-4 py-2.5 rounded-lg bg-bg-surface border border-bg-border text-sm text-text-primary hover:border-amber/40 hover:bg-amber/5 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── stats panel (desktop right) ──────────────────────────────────────────────

function StatsPanel({
  mes,
  ano,
  onQuickSelect,
}: {
  mes: number
  ano: number
  onQuickSelect: (q: string) => void
}) {
  const { data: stats, isLoading } = useMonthlyStats(mes, ano)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium text-text-muted mb-3">
          {MONTHS[mes - 1]} {ano}
        </p>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-bg-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="flex flex-col gap-2">
            {[
              { label: 'Receitas', value: stats.receitas, color: 'text-success' },
              { label: 'Despesas', value: stats.despesas, color: 'text-danger' },
              { label: 'Saldo', value: stats.saldo, color: stats.saldo >= 0 ? 'text-success' : 'text-danger' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-surface"
              >
                <span className="text-xs text-text-muted">{label}</span>
                <span className={`text-sm font-medium ${color}`}>{formatBRL(value)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {stats && stats.categorias.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-muted mb-3">Top categorias</p>
          <div className="flex flex-col gap-2">
            {stats.categorias.slice(0, 4).map((cat) => (
              <div key={cat.categoria} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-primary truncate max-w-[120px]">
                    {cat.categoria}
                  </span>
                  <span className="text-xs text-text-muted">{Number(cat.percentual).toFixed(0)}%</span>
                </div>
                <div className="h-1 rounded-full bg-bg-border">
                  <div
                    className="h-1 rounded-full bg-amber"
                    style={{ width: `${Math.min(cat.percentual, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-text-muted mb-3">Perguntas rápidas</p>
        <div className="flex flex-col gap-1.5">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => onQuickSelect(q)}
              className="text-left px-3 py-2 rounded-lg bg-bg-surface border border-bg-border text-xs text-text-primary hover:border-amber/40 hover:bg-amber/5 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── chat input bar ───────────────────────────────────────────────────────────

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  isLoading: boolean
}

function ChatInput({ value, onChange, onSend, isLoading }: ChatInputProps) {
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-bg-border bg-bg">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Pergunte sobre suas finanças..."
        rows={1}
        disabled={isLoading}
        className="flex-1 resize-none px-3 py-2.5 rounded-xl text-sm text-text-primary bg-bg-surface border border-bg-border placeholder:text-text-muted focus:outline-none focus:border-amber transition-colors disabled:opacity-50 max-h-32 overflow-y-auto"
        style={{ lineHeight: '1.4' }}
      />
      <button
        onClick={onSend}
        disabled={!value.trim() || isLoading}
        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-amber text-bg hover:bg-amber-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label="Enviar"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M14 8L2 2l2.5 6L2 14l12-6z" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const isMobile = useBreakpoint('md')
  const { mes, ano } = currentMonthYear()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || isLoading) return

    // Snapshot history from current state before any update (safe: read at call site, not inside updater)
    const historico = messages.map((m) => ({ role: m.role, text: m.text }))
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: msg }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const resposta = await sendMessage(msg, mes, ano, historico)
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: resposta },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Não foi possível processar sua pergunta no momento. Tente novamente.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // on mobile, quick-question chips send immediately
  // on desktop, they just fill the input
  const handleQuickSelect = (q: string) => {
    if (isMobile) {
      handleSend(q)
    } else {
      setInput(q)
    }
  }

  // ─── shared fragments ──────────────────────────────────────────────────────

  const messageList = (
    <div className="flex flex-col gap-4 px-4 py-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} msg={msg} />
      ))}
      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )

  // ─── mobile ────────────────────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onSelect={handleQuickSelect} isMobile />
          ) : (
            messageList
          )}
        </div>

        {/* Quick chips (only when there are messages) — always auto-send on mobile */}
        {messages.length > 0 && !isLoading && (
          <div className="shrink-0 flex gap-2 overflow-x-auto px-4 py-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-bg-surface border border-bg-border text-text-muted hover:text-text-primary hover:border-amber/40 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="shrink-0">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => handleSend()}
            isLoading={isLoading}
          />
        </div>
      </div>
    )
  }

  // ─── desktop ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onSelect={handleQuickSelect} isMobile={false} />
          ) : (
            messageList
          )}
        </div>

        <div className="shrink-0">
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => handleSend()}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Right panel */}
      <aside className="w-64 shrink-0 border-l border-bg-border overflow-y-auto p-4">
        <StatsPanel mes={mes} ano={ano} onQuickSelect={handleQuickSelect} />
      </aside>
    </div>
  )
}
