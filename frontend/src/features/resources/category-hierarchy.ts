type Category = Record<string, unknown>

export function categoryPath(category: Category, rows: Category[]): string {
  const byId = new Map(rows.map(row => [String(row.id), row]))
  const names = [String(category.name)]
  const visited = new Set([String(category.id)])
  let parent = byId.get(String(category.parent_id))
  while (parent && !visited.has(String(parent.id))) {
    names.unshift(String(parent.name))
    visited.add(String(parent.id))
    parent = byId.get(String(parent.parent_id))
  }
  return names.join(' / ')
}

export function eligibleParents(rows: Category[], currentId?: unknown): Category[] {
  if (currentId == null) return rows
  const excluded = new Set([String(currentId)])
  let changed = true
  while (changed) {
    changed = false
    for (const row of rows) {
      if (excluded.has(String(row.parent_id)) && !excluded.has(String(row.id))) {
        excluded.add(String(row.id))
        changed = true
      }
    }
  }
  return rows.filter(row => !excluded.has(String(row.id)))
}
