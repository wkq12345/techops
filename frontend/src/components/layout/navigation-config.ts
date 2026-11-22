import { LayoutDashboard, type LucideIcon } from 'lucide-react'
import { resourceByPath } from '../../features/resources/resource-config'

interface NavigationItem { label: string; icon: LucideIcon; to: string; permission?: string }

function moduleLink(path: string, permission: string, label?: string): NavigationItem {
  const resource = resourceByPath[path]
  return { label: label ?? resource.title, icon: resource.icon, to: `/modules/${path}`, permission }
}

export const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  { label: 'Sales', items: [
    moduleLink('sales-orders', 'sales.create'),
    moduleLink('invoices', 'products.view'),
    moduleLink('warranties', 'products.view'),
    moduleLink('returns', 'sales.create'),
    moduleLink('customers', 'products.view'),
  ] },
  { label: 'Inventories', items: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
    moduleLink('inventory', 'inventory.view'),
    moduleLink('products', 'products.view'),
    moduleLink('brands', 'products.view'),
    moduleLink('categories', 'products.view'),
    moduleLink('serialized-units', 'products.view'),
    moduleLink('stock-movements', 'products.view'),
    moduleLink('warehouses', 'products.view'),
    moduleLink('warehouse-bins', 'products.view'),
  ] },
  { label: 'Purchasing', items: [
    moduleLink('purchase-orders', 'purchases.create'),
    moduleLink('goods-receipts', 'products.view'),
    moduleLink('suppliers', 'products.view'),
  ] },
  { label: 'Services', items: [
    moduleLink('repairs', 'repairs.view'),
    moduleLink('pc-builds', 'sales.create', 'PC Builder'),
  ] },
  { label: 'Administration', items: [
    moduleLink('reports', 'reports.view'),
    moduleLink('users', 'users.manage'),
    moduleLink('audit-logs', 'users.manage'),
  ] },
]

export const navigation = navigationGroups.flatMap(group => group.items)

export function navigationSection(pathname: string): string {
  return navigationGroups.find(group => group.items.some(item => item.to === pathname))?.label ?? 'Operations'
}
