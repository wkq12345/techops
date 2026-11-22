import { useMutation } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { apiClient } from '../../services/api-client'
import { getFormError } from '../auth/form-error'

interface Compatibility { status: string; results: Array<{ status: string; message: string }> }

export function PcBuildCompatibility({ buildId, showSaveHint = false }: { buildId: number; showSaveHint?: boolean }) {
  const check = useMutation({ mutationFn: async () => (await apiClient.post<{ data: Compatibility }>(`/api/v1/pc-builds/${buildId}/validate`)).data.data })
  return <div className="action-form">
    <h3>Compatibility check</h3>
    {showSaveHint && <p>Checks saved components. Save your changes before checking again.</p>}
    <Button variant="primary" disabled={check.isPending} onClick={() => check.mutate()}>{check.isPending ? 'Checking…' : 'Check compatibility'}</Button>
    {check.isError && <div className="alert alert-error" role="alert">{getFormError(check.error)}</div>}
    {check.data && <div className="compatibility-results"><strong className={`compatibility-status compatibility-status--${check.data.status}`}>Result: {check.data.status}</strong>{check.data.results.map((result, index) => <p className={`compatibility-line compatibility-line--${result.status}`} key={index}>{result.status}: {result.message}</p>)}</div>}
  </div>
}
