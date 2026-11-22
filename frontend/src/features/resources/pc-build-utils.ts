export function editablePcBuild(row: Record<string, unknown>): boolean {
  const items = Array.isArray(row.items) ? row.items as Array<Record<string, unknown>> : []
  return row.status === 'draft' && !row.sales_order_id && Number(row.reserved_items_count ?? 0) === 0
    && !items.some(item => [true, 1, '1', 'true'].includes(item.is_reserved as boolean | number | string))
}
