import { forwardRef, useState, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  showToggle?: boolean
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', showToggle, type, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const effectiveType = showToggle ? (visible ? 'text' : 'password') : type

    const inputEl = (
      <input
        id={id}
        ref={ref}
        type={effectiveType}
        className={[
          'w-full px-3 py-3 rounded-sm text-sm text-text-primary',
          'bg-bg-surface placeholder:text-text-muted',
          'border focus:outline-none focus:border-amber',
          'transition-colors duration-150',
          error ? 'border-danger' : 'border-bg-border',
          showToggle ? 'pr-10' : '',
          className,
        ].join(' ')}
        {...props}
      />
    )

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-text-muted">
            {label}
          </label>
        )}
        {showToggle ? (
          <div className="relative">
            {inputEl}
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              {visible ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        ) : (
          inputEl
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input
