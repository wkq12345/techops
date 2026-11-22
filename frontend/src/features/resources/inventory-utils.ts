export function stockStatus(onHand: unknown, available: unknown): string {
  if (Number(available) > 0) return 'available'
  return Number(onHand) > 0 ? 'fully_reserved' : 'out_of_stock'
}
