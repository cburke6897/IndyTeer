/** Terms checkbox shown in onboarding only when the account has no recorded acceptance. */
export function TermsConsent({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  return (
    <div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 rounded border-line-strong accent-navy" />
        <span>I agree to the Terms of Service and Privacy Policy.</span>
      </label>
      {error && <p role="alert" className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
    </div>
  )
}
