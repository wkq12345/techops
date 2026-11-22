import { useIsMutating, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, LoaderCircle, Search, RefreshCw, Plus, History } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink } from '../../components/ui/Button'
import { RowActionButton } from '../../components/ui/RowActionButton'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { DataTable, type TableColumn, type TableSort } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { navigationSection } from '../../components/layout/navigation-config'
import { apiClient } from '../../services/api-client'
import { useCurrentUser } from '../auth/use-current-user'
import { GenericRecordForm } from './GenericRecordForm'
import { DeleteRecordForm } from './DeleteRecordForm'
import { UserRecordForm } from './UserRecordForm'
import { InventoryActionForm } from './InventoryActionForm'
import { PcBuildCreateForm, PcBuildEditForm } from './PcBuildCreateForm'
import { editablePcBuild } from './pc-build-utils'
import { PurchaseOrderCreateForm } from './PurchaseOrderCreateForm'
import { RecordActions } from './RecordActions'
import { RepairCreateForm } from './RepairCreateForm'
import { ReturnCreateForm } from './ReturnCreateForm'
import { SalesOrderCreateForm } from './SalesOrderCreateForm'
import { resourceByPath } from './resource-config'
import { useCatalog } from './workflow-utils'
import { editableFields } from './resource-forms'
import { stockStatus } from './inventory-utils'
import { ReplenishmentDraftForm } from './ReplenishmentDraftForm'

interface PageResponse { data: Array<Record<string, unknown>>; next_page_url?: string | null; current_page?: number; last_page?: number; total?: number }
type Mode = 'create' | 'edit' | 'delete' | 'adjust' | 'transfer' | 'restock' | 'manage' | null
const searchable = new Set(['users', 'brands', 'categories', 'customers', 'suppliers', 'products', 'warehouses', 'warehouse-bins', 'invoices', 'goods-receipts', 'warranties', 'sales-orders', 'purchase-orders'])
const managed = new Set(['sales-orders', 'repairs', 'purchase-orders', 'pc-builds', 'invoices'])
const generated = new Set(['serialized-units', 'stock-movements', 'invoices', 'goods-receipts', 'audit-logs'])
const createTitles: Record<string, string> = {
  categories: 'Create category',
  'sales-orders': 'Create sales order', repairs: 'Open repair job',
  'purchase-orders': 'Create purchase order', 'pc-builds': 'Create PC build', returns: 'Create customer return',
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') return new Intl.NumberFormat('en-MY', { maximumFractionDigits: 2 }).format(value)
  if (typeof value === 'object') return JSON.stringify(value)
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat('en-MY', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      timeZone: 'Asia/Kuala_Lumpur',
    }).format(date)
  }
  return String(value).replaceAll('_', ' ')
}

export function ResourcePage() {
  const { resource = '' } = useParams()
  return <ResourceWorkspace key={resource} resource={resource} />
}

function ResourceWorkspace({ resource }: { resource: string }) {
  const config = resourceByPath[resource]
  const { data: user } = useCurrentUser()
  const queryClient = useQueryClient()
  const isSaving = useIsMutating() > 0
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<TableSort>({ key: 'id', direction: 'desc' })
  const [mode, setMode] = useState<Mode>(null)
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const warehouses = useCatalog('warehouses', resource === 'warehouse-bins')
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedRecord = searchParams.get('record')
  const can = (permission: string) => Boolean(user?.permissions?.includes(permission) || user?.roles?.includes('super-admin'))
  const isAdministrator = Boolean(user?.roles?.some(role => ['admin', 'super-admin'].includes(role)))

  const query = useQuery({
    queryKey: ['resource', config?.endpoint, search, page, sort.key, sort.direction, resource === 'warehouse-bins' ? warehouseFilter : 'all'],
    enabled: Boolean(config && config.path !== 'reports'),
    queryFn: async () => (await apiClient.get<PageResponse>(`/api/v1/${config.endpoint}`, {
      params: { warehouse_id: resource === 'warehouse-bins' && warehouseFilter !== 'all' ? Number(warehouseFilter) : undefined, search: searchable.has(resource) && search || undefined, page, per_page: 30, sort_by: sort.key, sort_direction: sort.direction },
    })).data,
  })
  const record = useQuery({ queryKey: ['resource-link', resource, requestedRecord], enabled: Boolean(requestedRecord && managed.has(resource) && config), queryFn: async () => (await apiClient.get<{ data: Record<string, unknown> }>(`/api/v1/${config.endpoint}/${requestedRecord}`)).data.data })
  useEffect(() => { if (record.data && requestedRecord) { setSelected(record.data); setMode(resource === 'pc-builds' && editablePcBuild(record.data) ? 'edit' : 'manage') } }, [record.data, requestedRecord, resource])

  if (!config) return <main className="dashboard"><div className="empty-state"><h1>Module not found</h1></div></main>
  if (config.path === 'reports') return <ReportPage />
  const recordName = config.recordName ?? (resource === 'products' ? 'product' : resource.replaceAll('-', ' '))
  const canCreate = resource === 'users' ? isAdministrator : editableFields[resource] ? can('products.create')
    : resource === 'sales-orders' || resource === 'pc-builds' ? can('sales.create')
      : resource === 'repairs' ? can('repairs.update')
        : resource === 'purchase-orders' ? can('purchases.create')
          : resource === 'returns' ? can('sales.approve') : false
  const canManageRow = (row: Record<string, unknown>) => {
    if (resource === 'invoices') return can('products.view')
    const status = String(row.status)
    if (resource === 'sales-orders') return can('sales.approve') && ['confirmed', 'processing'].includes(status)
    if (resource === 'repairs') return can('repairs.update') && !['completed', 'cancelled'].includes(status)
    if (resource === 'purchase-orders') return status === 'pending_approval' ? can('purchases.approve') : ['approved', 'ordered', 'partially_received'].includes(status) && can('purchases.create')
    return false
  }
  const close = () => { setMode(null); setSelected(null); if (requestedRecord) setSearchParams({}, { replace: true }) }
  const dismiss = () => { if (!isSaving) close() }
  const saved = () => { close(); setSearch(''); setPage(1); void queryClient.invalidateQueries({ queryKey: ['dashboard'] }); void queryClient.invalidateQueries({ queryKey: ['reports'] }); void queryClient.invalidateQueries({ queryKey: ['catalog'] }) }
  const openEdit = (row: Record<string, unknown>) => { setSelected(row); setMode('edit') }
  const openManage = (row: Record<string, unknown>) => { setSelected(row); setMode('manage') }
  const rows = query.data?.data ?? []
  const visibleRows = rows.filter(row => {
    if (resource === 'inventory') return (warehouseFilter === 'all' || String(row.warehouse_name) === warehouseFilter)
      && (statusFilter === 'all' || (statusFilter === 'available' ? Number(row.available_quantity) > 0 : Number(row.available_quantity) <= 0))
      && (!search || `${row.sku} ${row.product_name}`.toLowerCase().includes(search.toLowerCase()))
    if (resource === 'products') return (statusFilter === 'all' || row.status === statusFilter) && (typeFilter === 'all' || row.product_type === typeFilter)
    return true
  })
  const isFiltered = Boolean(search || statusFilter !== 'all' || typeFilter !== 'all' || warehouseFilter !== 'all')
  const resetFilters = () => { setSearch(''); setPage(1); setStatusFilter('all'); setTypeFilter('all'); setWarehouseFilter('all') }
  const columns: TableColumn[] = [{ key: 'id', label: 'ID' }, ...config.columns]
  const moneyKeys = new Set(['selling_price', 'cost_price', 'total', 'estimated_cost', 'budget', 'estimated_total'])
  function renderCell(row: Record<string, unknown>, column: TableColumn) {
    if (column.key === 'id') return <span className="sku-cell">{String(row.id)}</span>
    if (resource === 'users' && column.key === 'role') return row.role === 'admin' ? 'Admin' : 'Staff'
    if (resource === 'warranties' && column.key === 'customer_name') return display(row.customer_name)
    if (resource === 'sales-orders' && column.key === 'customer_name') return row.customer_name ? <span className="cell-primary">{display(row.customer_name)}</span> : 'Walk-in customer'
    if (resource === 'audit-logs' && column.key === 'entity_detail') {
      const snapshot = (row.new_values ?? row.old_values) as Record<string, unknown> | null
      const recordLabel = snapshot && ['number', 'name', 'company_name', 'sku', 'customer_code', 'supplier_code', 'serial_number', 'email'].map(key => snapshot[key]).find((value): value is string => typeof value === 'string' && value.length > 0)
      const entityType = String(row.entity_type ?? 'Record').split('\\').pop()?.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ') ?? 'Record'
      return <span className="cell-primary">{entityType}{recordLabel ? ` - ${recordLabel}` : ''}</span>
    }
    if (resource === 'audit-logs' && column.key === 'user_name') return display(row.user_name ?? 'System')
    if (['technician_name', 'supplier_name', 'sales_order_number', 'purchase_order_number', 'product_name', 'warehouse_name', 'location_name'].includes(column.key) && row[column.key] == null) return '—'
    if (column.key === 'customer_name' && row.customer_name == null && ['invoices', 'returns'].includes(resource)) return 'Walk-in customer'
    if (resource === 'categories' && column.key === 'parent') return row.parent ? String((row.parent as Record<string, unknown>).name) : 'Top level'
    if (column.key === 'status') return <StatusBadge status={String(row.status ?? 'unknown')} />
    if (column.key === 'availability') return <StatusBadge status={stockStatus(row.quantity, row.available_quantity)} />
    if (moneyKeys.has(column.key) && row[column.key] != null) return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(row[column.key]))
    if (resource === 'warehouse-bins' && column.key === 'name' && row.is_unassigned) return <span className="cell-primary">{display(row.name)} <small className="muted-text">(system)</small></span>
    if (column.key === 'sku') return <span className="sku-cell">{display(row[column.key])}</span>
    if (column.key === 'available_quantity') return <strong className={Number(row.available_quantity) <= 0 ? 'attention-number' : ''}>{display(Number(row.available_quantity))}</strong>
    if (['quantity', 'reserved_quantity', 'reorder_level'].includes(column.key)) return row[column.key] == null ? '—' : display(Number(row[column.key]))
    if (['name', 'product_name'].includes(column.key)) return <span className="cell-primary">{display(row[column.key])}</span>
    return display(row[column.key])
  }
  const canEdit = resource === 'users' ? isAdministrator : resource === 'pc-builds' ? can('sales.create') : Boolean(editableFields[resource] && can('products.update'))
  const canDelete = Boolean(config.deletable && isAdministrator)
  const hasRowActions = resource === 'invoices' ? rows.some(canManageRow) : canEdit || canDelete || rows.some(canManageRow)
  const buildLocked = 'Only unlinked draft builds with no reserved components can be edited or deleted.'
  function rowActions(row: Record<string, unknown>) {
    const locked = (resource === 'pc-builds' && !editablePcBuild(row)) || (resource === 'warehouse-bins' && Boolean(row.is_unassigned))
    const ownAccount = resource === 'users' && row.id === user?.id
    const deleteAllowed = canDelete && !(resource === 'sales-orders' && row.status === 'completed')
    return <>
      {resource === 'invoices' && canManageRow(row) && <RowActionButton action="print" title="View / print invoice" onClick={() => openManage(row)} />}
      {resource === 'pc-builds' && canEdit && editablePcBuild(row) && <RowActionButton action="edit" title="Edit draft" onClick={() => openEdit(row)} />}
      {resource === 'pc-builds' && canEdit && <RowActionButton action="manage" title="Manage build workflow" onClick={() => openManage(row)} />}
      {resource !== 'invoices' && resource !== 'pc-builds' && (canEdit || canManageRow(row)) && <RowActionButton action="edit" disabled={locked} title={locked ? resource === 'warehouse-bins' ? 'System Unassigned location is protected' : buildLocked : 'Edit'} onClick={() => canEdit ? openEdit(row) : openManage(row)} />}
      {deleteAllowed && <RowActionButton action="delete" disabled={locked || ownAccount} title={ownAccount ? 'You cannot delete your own account' : locked ? resource === 'warehouse-bins' ? 'System Unassigned location is protected' : buildLocked : 'Delete'} onClick={() => { setSelected(row); setMode('delete') }} />}
    </>
  }
  const modalTitle = mode === 'adjust' ? 'Adjust stock' : mode === 'transfer' ? 'Transfer stock'
    : mode === 'restock' ? 'Create replenishment draft'
    : mode === 'delete' ? `Delete ${recordName}`
    : mode === 'manage' ? `${resource === 'invoices' ? 'Invoice' : `Edit ${recordName}`}${selected?.number ? ` · ${selected.number}` : ''}`
      : mode === 'edit' ? `Edit ${recordName}`
        : createTitles[resource] || `Create ${recordName}`

  return <main className="dashboard">
    <PageHeader title={config.title} description={config.description} section={navigationSection(`/modules/${resource}`)} actions={<>
      {resource === 'inventory' && <ButtonLink to="/modules/stock-movements"><History />Movement history</ButtonLink>}
      {resource === 'inventory' && can('purchases.create') && <Button onClick={() => setMode('restock')}>Restock suggestions</Button>}
      {resource === 'inventory' && can('inventory.transfer') && <Button onClick={() => setMode('transfer')}>Transfer stock</Button>}
      {resource === 'inventory' && can('inventory.adjust') && <Button variant="primary" onClick={() => setMode('adjust')}>Adjust stock</Button>}
      {canCreate && <Button variant="primary" onClick={() => setMode('create')}><Plus />New {config.recordName ?? (resource === 'products' ? 'product' : resource === 'sales-orders' ? 'sales order' : resource === 'purchase-orders' ? 'purchase order' : resource === 'repairs' ? 'repair' : resource === 'pc-builds' ? 'build' : resource === 'returns' ? 'return' : 'record')}</Button>}
    </>} />
    {record.isError && <div className="alert alert-error" role="alert">Unable to open the selected record. <Button size="small" onClick={() => void record.refetch()}>Retry</Button></div>}
    {mode && <Modal key={`${resource}:${mode}:${selected?.id ?? 'new'}`} title={modalTitle} size={['sales-orders', 'purchase-orders', 'pc-builds', 'inventory'].includes(resource) ? 'wide' : 'default'} busy={isSaving} onClose={dismiss}>
      {mode === 'delete' && selected && config.deletable && isAdministrator && <DeleteRecordForm resource={resource} recordLabel={recordName} record={selected} onCancel={dismiss} onDeleted={saved} />}
      {resource === 'users' && ['create', 'edit'].includes(mode) && isAdministrator && <UserRecordForm initial={mode === 'edit' && selected ? selected : undefined} currentUserId={user?.id} onCancel={dismiss} onSaved={saved} />}
      {mode === 'create' && editableFields[resource] && <GenericRecordForm key={resource} resource={resource} onCancel={dismiss} onSaved={saved} />}
      {mode === 'edit' && selected && editableFields[resource] && <GenericRecordForm key={String(selected.id)} resource={resource} initial={selected} onCancel={dismiss} onSaved={saved} />}
      {mode === 'create' && resource === 'sales-orders' && <SalesOrderCreateForm onCancel={dismiss} onCreated={saved} />}
      {mode === 'create' && resource === 'repairs' && <RepairCreateForm onCancel={dismiss} onSaved={saved} />}
      {mode === 'create' && resource === 'purchase-orders' && <PurchaseOrderCreateForm onCancel={dismiss} onSaved={saved} />}
      {mode === 'create' && resource === 'pc-builds' && <PcBuildCreateForm onCancel={dismiss} onSaved={saved} />}
      {mode === 'edit' && resource === 'pc-builds' && selected && <PcBuildEditForm id={Number(selected.id)} onCancel={dismiss} onSaved={saved} />}
      {mode === 'create' && resource === 'returns' && <ReturnCreateForm onCancel={dismiss} onSaved={saved} />}
      {mode === 'adjust' && <InventoryActionForm mode="adjust" onCancel={dismiss} onSaved={saved} />}
      {mode === 'transfer' && <InventoryActionForm mode="transfer" onCancel={dismiss} onSaved={saved} />}
      {mode === 'restock' && resource === 'inventory' && <ReplenishmentDraftForm onCancel={dismiss} onSaved={saved} />}
      {mode === 'manage' && selected && managed.has(resource) && <RecordActions key={String(selected.id)} resource={config.endpoint} row={selected} onClose={dismiss} />}
    </Modal>}
    <div className="table-panel">
      <div className="table-toolbar">
        <div className="toolbar-filters">
          {(searchable.has(resource) || resource === 'inventory') ? <div className="search-box"><Search aria-hidden="true" /><input aria-label={`Search ${config.title.toLowerCase()}`} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder={resource === 'inventory' ? 'Find SKU or product on this page' : resource === 'sales-orders' ? 'Search order number or customer…' : resource === 'purchase-orders' ? 'Search PO number or supplier…' : `Search ${config.title.toLowerCase()}…`} /></div> : <span>{generated.has(resource) ? 'Created by related workflows; view history here.' : 'Latest records'}</span>}
          {resource === 'warehouse-bins' && <select className="filter-control" aria-label="Filter warehouse" value={warehouseFilter} onChange={event => { setWarehouseFilter(event.target.value); setPage(1) }}><option value="all">All warehouses</option>{warehouses.data?.map(row => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}</select>}
          {resource === 'inventory' && <><select className="filter-control" aria-label="Filter warehouse" value={warehouseFilter} onChange={event => setWarehouseFilter(event.target.value)}><option value="all">All warehouses</option>{[...new Set(rows.map(row => String(row.warehouse_name)))].map(name => <option key={name}>{name}</option>)}</select><select className="filter-control" aria-label="Filter availability" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All availability</option><option value="available">Available</option><option value="out_of_stock">No available stock</option></select></>}
          {resource === 'products' && <><select className="filter-control" aria-label="Filter product status" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><select className="filter-control" aria-label="Filter product type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">All types</option><option value="physical">Physical</option><option value="serialized">Serialized</option><option value="service">Service</option></select></>}
          {isFiltered && <Button variant="ghost" size="small" onClick={resetFilters}>Clear filters</Button>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Refresh records" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? 'spinner' : ''} /></Button>
      </div>
      {query.isLoading ? <div className="table-state"><LoaderCircle className="spinner" />Loading records…</div>
        : query.isError ? <div className="table-state error-text" role="alert">Unable to load this module. Check your permission and API connection.<Button onClick={() => void query.refetch()}>Retry</Button></div>
          : visibleRows.length === 0 ? <div className="table-state">{isFiltered ? 'No records match these filters.' : 'No records yet.'}{isFiltered && <Button onClick={resetFilters}>Clear filters</Button>}</div>
            : <DataTable label={config.title} minWidth={config.tableMinWidth} columns={columns} rows={visibleRows} renderCell={renderCell} sort={sort} onSort={next => { setSort(next); setPage(1) }} rowActions={hasRowActions ? rowActions : undefined} />}
      <div className="table-footnote"><span>{visibleRows.length} of {query.data?.total ?? rows.length} records · Page {query.data?.current_page ?? page} of {query.data?.last_page ?? 1}{['inventory', 'products'].includes(resource) && ' · Dropdown filters apply to this page'}</span><div className="resource-actions">{page > 1 && <><Button size="small" disabled={query.isFetching} onClick={() => setPage(1)}>First page</Button><Button size="small" disabled={query.isFetching} onClick={() => setPage(previous => previous - 1)}><ChevronLeft />Previous</Button></>}{query.data?.next_page_url && <Button size="small" disabled={query.isFetching} onClick={() => setPage(previous => previous + 1)}>Next<ChevronRight /></Button>}</div></div>
    </div>
  </main>
}

function ReportPage() {
  const query = useQuery({ queryKey: ['reports'], queryFn: async () => (await apiClient.get<{ data: Record<string, Record<string, unknown>> }>('/api/v1/reports/dashboard')).data.data })
  return <main className="dashboard"><PageHeader title="Operational reports" section={navigationSection('/modules/reports')} description="Live summaries across sales, inventory, repairs and purchasing." />{query.isError ? <div className="alert alert-error">Could not load reports.</div> : query.isLoading ? <div className="table-state"><LoaderCircle className="spinner" />Loading reports…</div> : <section className="report-grid">{Object.entries(query.data ?? {}).filter(([, value]) => !Array.isArray(value)).map(([group, values]) => <article className="panel" key={group}><h2>{group.replaceAll('_', ' ')}</h2>{Object.entries(values).map(([key, value]) => <div className="report-line" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{display(value)}</strong></div>)}</article>)}</section>}</main>
}
