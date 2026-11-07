import { useRef, useState, type ReactNode } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { cn, readImage } from '../../lib/utils'
import { Button } from './Button'

interface Props {
  value: string | null
  onChange: (dataUrl: string | null) => void
  label: string
  shape?: 'circle' | 'square' | 'wide'
  hint?: string
  placeholder?: ReactNode
}

export function ImageUpload({ value, onChange, label, shape = 'square', hint, placeholder }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  async function pick(file?: File) {
    if (!file) return
    setError('')
    try {
      onChange(await readImage(file, shape === 'wide' ? 1400 : 500))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  const frame = shape === 'circle' ? 'size-24 rounded-full' : shape === 'wide' ? 'aspect-[16/7] w-full max-w-md rounded-lg' : 'size-24 rounded-lg'
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold text-ink">{label}</p>
      <div className={cn('flex gap-4', shape === 'wide' ? 'flex-col' : 'items-center')}>
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={`${value ? 'Change' : 'Upload'} ${label.toLowerCase()}`}
          className={cn('group relative flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-line-strong bg-surface text-muted transition-colors hover:border-navy-700 hover:bg-navy-50', frame)}
        >
          {value ? <img src={value} alt={`${label} preview`} className="size-full object-cover" /> : placeholder ?? <ImagePlus size={24} />}
          {value && <span className="absolute inset-0 hidden items-center justify-center bg-navy-950/50 text-xs font-semibold text-white group-hover:flex">Change</span>}
        </button>
        <div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Upload size={14} />} onClick={() => input.current?.click()}>{value ? 'Replace' : 'Upload'}</Button>
            {value && <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => onChange(null)}>Remove</Button>}
          </div>
          <p className="mt-2 text-xs text-muted">{hint ?? 'JPG or PNG. Previewed locally in your browser.'}</p>
          {error && <p role="alert" className="mt-1 text-xs font-medium text-danger">{error}</p>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
