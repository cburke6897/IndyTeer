import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Field } from './Field'
import { cn } from '../../lib/utils'

export function PasswordInput({ label, error, hint, ...rest }: { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} error={error} hint={hint}>
      {(id, d) => (
        <div className="relative">
          <input
            id={id}
            aria-invalid={!!error}
            aria-describedby={d}
            type={show ? 'text' : 'password'}
            className={cn('block h-10 w-full rounded-md border bg-white px-3 pr-10 text-sm text-ink transition-colors focus:border-navy-700 focus:ring-2 focus:ring-navy-700/25 focus:outline-none', error ? 'border-danger' : 'border-line-strong')}
            {...rest}
          />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      )}
    </Field>
  )
}
