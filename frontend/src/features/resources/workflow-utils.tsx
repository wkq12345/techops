import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../services/api-client'
import { Field } from '../../components/ui/Field'

export interface CatalogRow { id: number; name?: string; number?: string; sku?: string; code?: string; company_name?: string; status?: string; tracking_type?: string; cost_price?: string; selling_price?: string; product_id?: number; category_id?: number | null; parent_id?: number | null; warehouse_id?: number; bin_id?: number; serial_number?: string | null; imei?: string | null }
interface Page<T> { data: T[]; next_cursor?: string | null }

export function useCatalog<T extends CatalogRow = CatalogRow>(resource: string, enabled = true) {
  return useQuery({
    queryKey: ['catalog', resource],
    enabled,
    queryFn: async () => {
      const rows: T[] = []
      let cursor: string | null = null
      do {
        const response: Page<T> = (await apiClient.get<Page<T>>(`/api/v1/${resource}`, { params: { per_page: 100, cursor: cursor || undefined } })).data
        rows.push(...response.data)
        // Location choices must not silently stop at the first 100 records.
        cursor = response.next_cursor ?? null
      } while (cursor)
      return rows
    },
  })
}

export function optionLabel(row: CatalogRow): string {
  if (row.serial_number || row.imei) return String(row.serial_number || row.imei)
  const prefix = row.sku || row.code || row.number
  const name = row.name || row.company_name
  return [prefix, name].filter(Boolean).join(' — ') || String(row.id)
}

export function Choice({ label, value, onChange, rows, required = false }: {
  label: string; value: string; onChange: (value: string) => void; rows: CatalogRow[]; required?: boolean
}) {
  return <Field label={label} required={required}><select value={value} onChange={event => onChange(event.target.value)} required={required}><option value="">{required ? `Select ${label.toLowerCase()}` : 'None'}</option>{rows.map(row => <option key={row.id} value={row.id}>{optionLabel(row)}</option>)}</select></Field>
}
