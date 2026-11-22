import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'
import { Button } from './Button'
import { resources } from '../../features/resources/resource-config'

afterEach(cleanup)

it.each(resources.filter(resource => resource.columns.length))('keeps $title headers and cells aligned by column', resource => {
  render(<DataTable label={resource.title} columns={resource.columns} rows={[{ id: 1 }]} renderCell={(_row, column) => column.key} rowActions={() => <Button>Edit</Button>} />)
  const table = screen.getByRole('table')
  const widths = [...table.querySelectorAll('col')].map(column => column.style.width)
  expect(widths).toHaveLength(resource.columns.length + 1)
  expect(new Set(widths).size).toBe(1)
  const headers = within(table).getAllByRole('columnheader')
  const cells = within(table).getAllByRole('cell')
  resource.columns.forEach((column, index) => {
    expect(headers[index].className).toBe(cells[index].className)
    expect(headers[index]).toHaveAttribute('scope', 'col')
    expect(cells[index]).toHaveAttribute('data-label', column.label)
    if (column.align === 'right') expect(headers[index]).toHaveClass('numeric')
    if (column.align === 'center' || (!column.align && ['status', 'availability'].includes(column.key))) expect(headers[index]).toHaveClass('table-centered-cell')
  })
  expect(headers.at(-1)).toHaveClass('table-actions-cell')
  expect(cells.at(-1)).toHaveClass('table-actions-cell')
  expect(screen.getByRole('button', { name: 'Edit' }).parentElement).toHaveClass('table-row-actions')
})

it('also divides tables without row actions into equal columns', () => {
  render(<DataTable columns={[{ key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }]} rows={[{ id: 1 }]} renderCell={() => 'Value'} />)
  expect([...screen.getByRole('table').querySelectorAll('col')].map(column => column.style.width)).toEqual(['50%', '50%'])
})

it('exposes accessible sort headers without making row actions sortable', () => {
  const onSort = vi.fn()
  render(<DataTable columns={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }]} rows={[{ id: 8, name: 'Samsung' }]} renderCell={(row, column) => String(row[column.key])} sort={{ key: 'id', direction: 'desc' }} onSort={onSort} rowActions={() => <Button>Edit</Button>} />)
  expect(screen.getByRole('columnheader', { name: 'ID' })).toHaveAttribute('aria-sort', 'descending')
  expect(screen.getByRole('columnheader', { name: 'Name' })).toHaveAttribute('aria-sort', 'none')
  fireEvent.click(screen.getByRole('button', { name: 'ID' }))
  expect(onSort).toHaveBeenLastCalledWith({ key: 'id', direction: 'asc' })
  fireEvent.click(screen.getByRole('button', { name: 'Name' }))
  expect(onSort).toHaveBeenLastCalledWith({ key: 'name', direction: 'asc' })
  expect(within(screen.getByRole('columnheader', { name: 'Actions' })).queryByRole('button')).toBeNull()
})
