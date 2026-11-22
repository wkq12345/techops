export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary'
export function statusTone(status: string): StatusTone {
  if (['completed', 'active', 'available', 'approved', 'ready_for_collection', 'received'].includes(status)) return 'success'
  if (['cancelled', 'void', 'expired', 'out_of_stock', 'failed'].includes(status)) return 'danger'
  if (['pending_approval', 'awaiting_approval', 'awaiting_parts', 'low_stock', 'partially_received', 'fully_reserved'].includes(status)) return 'warning'
  if (['confirmed', 'processing', 'repairing', 'testing', 'diagnosing', 'ordered'].includes(status)) return 'primary'
  return 'neutral'
}
export function StatusBadge({ status, tone = statusTone(status) }: { status: string; tone?: StatusTone }) {
  return <span className={`ui-status ui-status--${tone}`}><span aria-hidden="true" />{status.replaceAll('_', ' ')}</span>
}
