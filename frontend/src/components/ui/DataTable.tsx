import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
export interface TableColumn { key: string; label: string; align?: 'left' | 'center' | 'right'; sortable?: boolean }
export interface TableSort { key: string; direction: 'asc' | 'desc' }

function columnClass(column: TableColumn): string | undefined {
  const align = column.align ?? (['status', 'availability'].includes(column.key) ? 'center' : 'left')
  const alignment = align === 'center' ? 'table-centered-cell' : align === 'right' ? 'numeric' : undefined
  return [column.key === 'id' ? 'table-id-cell' : undefined, alignment].filter(Boolean).join(' ') || undefined
}
export function DataTable({ columns, rows, renderCell, rowActions, label = 'Records', minWidth, sort, onSort }: {
  columns: TableColumn[]; rows: Array<Record<string, unknown>>
  label?: string; minWidth?: number
  renderCell: (row: Record<string, unknown>, column: TableColumn) => ReactNode
  rowActions?: (row: Record<string, unknown>) => ReactNode
  sort?: TableSort; onSort?: (sort: TableSort) => void
}) {
  const columnCount = columns.length + (rowActions ? 1 : 0)
  const columnWidth = `${100 / Math.max(columnCount, 1)}%`
  return <>
    <div className="table-scroll" role="region" aria-label={`${label} table`} tabIndex={0}>
      <table className="data-table" style={{ minWidth: Math.max(minWidth ?? 640, columnCount * 140) }}>
        <colgroup>{Array.from({ length: columnCount }, (_, index) => <col key={index} style={{ width: columnWidth }} />)}</colgroup>
        <thead><tr>
          {columns.map(column => {
            const sortable = Boolean(onSort && column.sortable !== false)
            const active = sortable && sort?.key === column.key
            const nextDirection = active && sort?.direction === 'asc' ? 'desc' : 'asc'
            const Icon = active ? sort?.direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown
            return <th key={column.key} className={columnClass(column)} scope="col" aria-sort={sortable ? active ? sort?.direction === 'asc' ? 'ascending' : 'descending' : 'none' : undefined}>
              {sortable ? <button type="button" className="table-sort" data-active={active} title={`Sort ${column.label.toLowerCase()} ${nextDirection === 'asc' ? 'ascending' : 'descending'}`} onClick={() => onSort?.({ key: column.key, direction: nextDirection })}>{column.label}<Icon aria-hidden="true" /></button> : column.label}
            </th>
          })}
          {rowActions && <th className="table-actions-cell" scope="col">Actions</th>}
        </tr></thead>
        <tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}>
          {columns.map(column => <td key={column.key} className={columnClass(column)} data-label={column.label}>{renderCell(row, column)}</td>)}
          {rowActions && <td className="table-actions-cell" data-label="Actions"><div className="table-row-actions">{rowActions(row)}</div></td>}
        </tr>)}</tbody>
      </table>
    </div>
    <p className="scroll-hint">Swipe horizontally to view all columns.</p>
  </>
}
