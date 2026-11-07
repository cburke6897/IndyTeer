import { cn } from '../../lib/utils'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-white hover:bg-navy-800 active:bg-navy-900',
  accent: 'bg-gold text-navy-950 hover:bg-gold-600 active:bg-gold-600',
  secondary: 'bg-white text-navy border border-line-strong hover:bg-navy-50 hover:border-navy-200',
  ghost: 'text-navy-700 hover:bg-navy-50',
  danger: 'bg-danger text-white hover:bg-red-800',
  dangerOutline: 'bg-white text-danger border border-red-200 hover:bg-danger-50',
}
const sizes: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-[15px]',
  md: 'h-11 px-5 text-base',
  lg: 'h-13 px-6 text-base',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-normal text-center transition-colors disabled:opacity-50 disabled:pointer-events-none',
    variants[variant], sizes[size], extra,
  )
}
