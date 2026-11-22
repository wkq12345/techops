import { apiClient } from '../../services/api-client'

export interface InventoryLocationOption { id: number; name: string; code: string; status: string; warehouse_id: number; available_quantity?: string | number | null }
export interface AvailableInventoryUnit { id: number; product_id: number; warehouse_id: number; bin_id: number; serial_number: string | null; imei: string | null; status: string }
interface Page<T> { data: T[]; next_cursor?: string | null }

async function allPages<T>(path: string, params: Record<string, string | number>, signal: AbortSignal): Promise<T[]> {
  const rows: T[] = []
  let cursor: string | null = null
  do {
    const response: Page<T> = (await apiClient.get<Page<T>>(path, { params: { ...params, per_page: 100, cursor: cursor || undefined }, signal })).data
    rows.push(...response.data)
    cursor = response.next_cursor ?? null
  } while (cursor)
  return rows
}

export const inventoryLocationQuery = (productId: number, warehouseId: number) => ({
  queryKey: ['catalog', 'inventory-locations', 'product', productId, warehouseId],
  queryFn: ({ signal }: { signal: AbortSignal }) => allPages<InventoryLocationOption>(`/api/v1/products/${productId}/inventory-locations`, { warehouse_id: warehouseId }, signal),
})

export const warehouseLocationQuery = (warehouseId: number) => ({
  queryKey: ['catalog', 'warehouse-bins', warehouseId],
  queryFn: ({ signal }: { signal: AbortSignal }) => allPages<InventoryLocationOption>('/api/v1/warehouse-bins', { warehouse_id: warehouseId, status: 'active' }, signal),
})

export const availableInventoryUnitQuery = (productId: number, warehouseId: number, locationId: number) => ({
  queryKey: ['catalog', 'available-inventory-units', productId, warehouseId, locationId],
  queryFn: ({ signal }: { signal: AbortSignal }) => allPages<AvailableInventoryUnit>('/api/v1/inventory-units', { product_id: productId, warehouse_id: warehouseId, bin_id: locationId, status: 'available' }, signal),
})
