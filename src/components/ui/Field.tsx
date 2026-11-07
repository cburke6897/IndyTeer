import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const control = 'block w-full rounded-md border bg-white px-3.5 text-base text-ink placeholder:text-muted/80 transition-colors focus:outline-none focus:ring-3 focus:ring-navy-700/30 focus:border-navy-700 disabled:bg-surface disabled:text-muted'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  optional?: boolean
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

export function Field({ label, error, hint, optional, className, children }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-[15px] font-semibold text-ink">
        <span>{label}</span>
        {optional && <span className="text-sm font-normal text-muted">Optional</span>}
      </label>
      {children(id, describedBy)}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-sm font-medium text-danger">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

type BaseProps = { label: string; error?: string; hint?: string; optional?: boolean; wrapperClassName?: string }

export function TextInput({ label, error, hint, optional, wrapperClassName, className, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {(id, d) => (
        <input id={id} aria-invalid={!!error} aria-describedby={d} className={cn(control, 'h-11', error ? 'border-danger' : 'border-line-strong', className)} {...rest} />
      )}
    </Field>
  )
}

export function TextArea({ label, error, hint, optional, wrapperClassName, className, ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {(id, d) => (
        <textarea id={id} aria-invalid={!!error} aria-describedby={d} rows={4} className={cn(control, 'py-2.5 leading-relaxed', error ? 'border-danger' : 'border-line-strong', className)} {...rest} />
      )}
    </Field>
  )
}

export function SelectInput({ label, error, hint, optional, wrapperClassName, className, children, ...rest }: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint} optional={optional} className={wrapperClassName}>
      {(id, d) => (
        <select id={id} aria-invalid={!!error} aria-describedby={d} className={cn(control, 'h-11 pr-8', error ? 'border-danger' : 'border-line-strong', className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}

/** Compact select for filter bars (visible label via aria-label). */
export function FilterSelect({ label, className, children, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select aria-label={label} className={cn(control.replace('block w-full', 'inline-block w-auto'), 'h-9 border-line-strong py-0 pr-8 text-[13px] font-medium', className)} {...rest}>
      {children}
    </select>
  )
}
