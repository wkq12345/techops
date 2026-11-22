import type { ReactNode } from 'react'
interface LabelProps { label: string; required?: boolean; optional?: boolean }

export function FieldLabel({ label, required, optional }: LabelProps) {
  return <span className="ui-field-label">{label}{required ? <span className="required-mark" aria-hidden="true">*</span> : optional && <span className="optional-label">optional</span>}</span>
}

export function Field({ label, required, optional, hint, children }: { label: string; required?: boolean; optional?: boolean; hint?: string; children: ReactNode }) {
  return <label className="ui-field"><FieldLabel label={label} required={required} optional={optional} />{children}{hint && <small>{hint}</small>}</label>
}
