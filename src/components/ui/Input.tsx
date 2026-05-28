import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-xs font-medium text-text-muted">
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={[
            'w-full px-3 py-3 rounded-sm text-sm text-text-primary',
            'bg-bg-surface placeholder:text-text-muted',
            'border focus:outline-none focus:border-amber',
            'transition-colors duration-150',
            error ? 'border-danger' : 'border-bg-border',
            className,
          ].join(' ')}
          {...props}
        />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'

export default Input
