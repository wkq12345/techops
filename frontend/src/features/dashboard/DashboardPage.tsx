import { useQuery } from '@tanstack/react-query'
import { RefreshCw, ArrowRight, ClipboardList, ShoppingCart, Wrench, Truck, PackageCheck, CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, ButtonLink } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/PageHeader'
import { navigationSection } from '../../components/layout/navigation-config'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { apiClient } from '../../services/api-client'
import { useCurrentUser } from '../auth/use-current-user'
import { stockStatus } from '../resources/inventory-utils'

interface DashboardReport { sales: { orders: number; completed: number; revenue: number }; inventory: { serialized_available: number; low_stock: number; quantity_value: number }; repairs: { active: number; total: number; revenue: number }; purchasing: { outstanding: number; spend: number } }
interface WorkRecord { id: number; number: string; status: string; total?: string; estimated_cost?: string; created_at?: string }
interface StockRecord { id: number; sku: string; product_name: string; warehouse_name: string; location_name: string; quantity: string; available_quantity: string }
const money = (value: unknown) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(Number(value || 0))

export function DashboardPage() {
  const { data: user } = useCurrentUser()
  const can = (permission: string) => Boolean(user?.roles.includes('super-admin') || user?.permissions.includes(permission))
  const [filter, setFilter] = useState('all')
  const report = useQuery({ queryKey: ['reports', 'dashboard'], enabled: can('reports.view'), queryFn: async () => (await apiClient.get<{ data: DashboardReport }>('/api/v1/reports/dashboard')).data.data })
  const sales = useQuery({ queryKey: ['dashboard', 'sales'], enabled: can('sales.create'), queryFn: async () => (await apiClient.get<{ data: WorkRecord[] }>('/api/v1/sales-orders', { params: { per_page: 30 } })).data.data })
  const repairs = useQuery({ queryKey: ['dashboard', 'repairs'], enabled: can('repairs.view'), queryFn: async () => (await apiClient.get<{ data: WorkRecord[] }>('/api/v1/repairs', { params: { per_page: 30 } })).data.data })
  const purchases = useQuery({ queryKey: ['dashboard', 'purchases'], enabled: can('purchases.create'), queryFn: async () => (await apiClient.get<{ data: WorkRecord[] }>('/api/v1/purchase-orders', { params: { per_page: 30 } })).data.data })
  const stock = useQuery({ queryKey: ['dashboard', 'stock'], enabled: can('inventory.view'), queryFn: async () => (await apiClient.get<{ data: StockRecord[] }>('/api/v1/inventory')).data.data })
  const sources = [
    { label: 'Sales', path: 'sales-orders', query: sales, actionable: ['confirmed', 'processing'] },
    { label: 'Repairs', path: 'repairs', query: repairs, actionable: ['received', 'diagnosing', 'awaiting_approval', 'awaiting_parts', 'repairing', 'testing', 'ready_for_collection'] },
    { label: 'Purchasing', path: 'purchase-orders', query: purchases, actionable: ['pending_approval', 'approved', 'ordered', 'partially_received'] },
  ]
  const queue = sources.flatMap(source => (source.query.data ?? []).filter(row => source.actionable.includes(row.status)).map(row => ({ ...row, workflow: source.label, path: source.path })))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  const visible = queue.filter(row => filter === 'all' || row.workflow === filter).slice(0, 12)
  const depleted = (stock.data ?? []).filter(row => Number(row.available_quantity) <= 0)
  const refreshing = [report, sales, repairs, purchases, stock].some(query => query.isFetching)
  const queueLoading = sources.some(source => source.query.isLoading && source.query.fetchStatus !== 'idle')
  const queueErrors = sources.filter(source => source.query.isError).map(source => source.label)
  function refresh() { for (const query of [report, sales, repairs, purchases, stock]) if (query.isEnabled) void query.refetch() }
  const data = report.data
  const stockTone = stock.isSuccess ? (depleted.length > 0 ? 'warning' : 'success') : 'primary'
  const lowStockTone = data ? (data.inventory.low_stock > 0 ? 'warning' : 'success') : 'primary'

  return <main className="dashboard">
    <PageHeader title="Operations overview" description="Open work and stock availability across your business." section={navigationSection('/dashboard')} actions={<Button variant="primary" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? 'spinner' : ''} />Refresh</Button>} />
    {report.isError && <div className="alert alert-error" role="alert">The business summary could not be loaded. <Button size="small" onClick={() => void report.refetch()}>Retry</Button></div>}
    {can('reports.view') && <section className="table-panel business-summary" aria-label="Business summary"><div className="table-scroll"><table><thead><tr>
      <th><span className="summary-label"><ShoppingCart aria-hidden="true" />Sales orders · all time</span></th>
      <th><span className="summary-label"><Wrench aria-hidden="true" />Active repairs</span></th>
      <th><span className="summary-label"><Truck aria-hidden="true" />Outstanding purchases</span></th>
      <th className={`summary-${lowStockTone}`}><span className="summary-label"><PackageCheck aria-hidden="true" />Low-stock lines</span></th>
    </tr></thead><tbody><tr>
      <td><strong>{data?.sales.orders ?? '—'}</strong><span>{data ? `${data.sales.completed} completed` : 'Summary unavailable'}</span></td>
      <td><strong>{data?.repairs.active ?? '—'}</strong><span>{data ? `${data.repairs.total} total jobs` : 'Summary unavailable'}</span></td>
      <td><strong>{data?.purchasing.outstanding ?? '—'}</strong><span>Open supplier orders</span></td>
      <td><strong>{data?.inventory.low_stock ?? '—'}</strong><span>{data ? `${money(data.inventory.quantity_value)} stock value` : 'Summary unavailable'}</span></td>
    </tr></tbody></table></div></section>}
    <div className="operations-grid">
      <section className="table-panel" aria-labelledby="work-queue-heading">
        <div className="section-bar"><div className="section-heading"><span className="section-icon"><ClipboardList aria-hidden="true" /></span><div><h2 id="work-queue-heading">Open work</h2><p>Latest loaded orders and jobs that need a next step</p></div></div><span className="queue-count">{queue.length} loaded</span></div>
        <div className="filter-tabs" aria-label="Filter work queue">{['all', ...sources.filter(source => source.query.isEnabled).map(source => source.label)].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All work' : value}<small>{value === 'all' ? queue.length : queue.filter(row => row.workflow === value).length}</small></button>)}</div>
        {queueErrors.length > 0 && <div className="alert alert-error" role="alert">Unable to load: {queueErrors.join(', ')}.</div>}
        {queueLoading ? <div className="table-state">Loading open work…</div> : visible.length === 0 ? <div className="table-state">No open work in the loaded records.</div> : <div className="table-scroll"><table><thead><tr><th>Reference</th><th>Workflow</th><th>Status</th><th className="numeric">Value</th><th><span className="sr-only">Open workflow</span></th></tr></thead><tbody>{visible.map(row => <tr key={`${row.path}-${row.id}`}><td className="cell-primary">{row.number}</td><td>{row.workflow}</td><td><StatusBadge status={row.status} /></td><td className="numeric">{row.total || row.estimated_cost ? money(row.total ?? row.estimated_cost) : '—'}</td><td><ButtonLink to={`/modules/${row.path}?record=${row.id}`} variant="ghost" size="small">Open<ArrowRight /></ButtonLink></td></tr>)}</tbody></table></div>}
        <div className="table-footnote"><span>Showing {visible.length} of {queue.length} loaded open records</span><span>Newest first</span></div>
      </section>
      {can('inventory.view') && <section className="table-panel" aria-labelledby="stock-watch-heading"><div className="section-bar"><div className="section-heading"><span className={`section-icon section-icon--${stockTone}`}><PackageCheck aria-hidden="true" /></span><div><h2 id="stock-watch-heading">Stock availability</h2><p>Loaded lines with no available stock</p></div></div><ButtonLink to="/modules/inventory" variant="ghost" size="small">Inventory<ArrowRight /></ButtonLink></div>
        {stock.isError ? <div className="table-state error-text">Stock availability could not be loaded.</div> : stock.isLoading ? <div className="table-state">Loading stock…</div> : depleted.length === 0 ? <div className="table-state table-state--success"><CircleCheck aria-hidden="true" />All loaded stock lines have available quantity.</div> : <div className="watch-list">{depleted.slice(0, 6).map(row => <div className="watch-item" key={row.id}><div><strong>{row.product_name}</strong><p>{row.sku} · {row.warehouse_name} / {row.location_name}</p></div><StatusBadge status={stockStatus(row.quantity, row.available_quantity)} /></div>)}</div>}
        <div className="table-footnote"><span>{stock.data?.length ?? 0} stock lines checked</span><Link to="/modules/inventory">View stock ledger</Link></div>
      </section>}
    </div>
    <p className="workspace-note">Queue counts reflect loaded records. Open each workflow to see its full history.</p>
  </main>
}
