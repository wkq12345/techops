export type Field = {
  name: string
  label: string
  kind?: 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select'
  required?: boolean
  source?: string
  options?: Array<{ value: string; label: string }>
  defaultValue?: string
  generated?: boolean
}

const status = (values = ['active', 'inactive']): Field => ({ name: 'status', label: 'Status', kind: 'select', options: values.map(value => ({ value, label: value.replaceAll('_', ' ') })), defaultValue: values[0] })

export const editableFields: Record<string, Field[]> = {
  brands: [
    { name: 'name', label: 'Brand name', required: true },
    status(),
  ],
  categories: [
    { name: 'name', label: 'Category name', required: true },
    { name: 'parent_id', label: 'Parent category', kind: 'select', source: 'categories' },
    status(),
  ],
  customers: [
    { name: 'customer_code', label: 'Customer code', generated: true },
    { name: 'name', label: 'Name', required: true },
    { name: 'email', label: 'Email', kind: 'email' },
    { name: 'phone', label: 'Phone' },
    { name: 'address', label: 'Address', kind: 'textarea' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
  ],
  suppliers: [
    { name: 'supplier_code', label: 'Supplier code', generated: true },
    { name: 'company_name', label: 'Company name', required: true },
    { name: 'contact_person', label: 'Contact person' },
    { name: 'email', label: 'Email', kind: 'email' },
    { name: 'phone', label: 'Phone' },
    { name: 'address', label: 'Address', kind: 'textarea' },
    { name: 'notes', label: 'Notes', kind: 'textarea' },
    status(),
  ],
  products: [
    { name: 'sku', label: 'SKU', generated: true },
    { name: 'name', label: 'Product name', required: true },
    { name: 'category_id', label: 'Category', kind: 'select', source: 'categories' },
    { name: 'brand_id', label: 'Brand', kind: 'select', source: 'brands' },
    { name: 'product_type', label: 'Product type', kind: 'select', required: true, options: ['physical', 'serialized', 'service'].map(value => ({ value, label: value })) },
    { name: 'tracking_type', label: 'Tracking', kind: 'select', required: true, options: ['quantity', 'serial', 'imei', 'none'].map(value => ({ value, label: value })) },
    { name: 'cost_price', label: 'Cost price', kind: 'number', required: true, defaultValue: '0' },
    { name: 'selling_price', label: 'Selling price', kind: 'number', required: true, defaultValue: '0' },
    { name: 'warranty_months', label: 'Warranty months', kind: 'number', defaultValue: '0' },
    { name: 'reorder_level', label: 'Reorder level', kind: 'number', defaultValue: '0' },
    { name: 'description', label: 'Description', kind: 'textarea' },
    status(),
  ],
  warehouses: [
    { name: 'code', label: 'Code', generated: true },
    { name: 'name', label: 'Warehouse name', required: true },
    { name: 'address', label: 'Address', kind: 'textarea' },
    status(),
  ],
  'warehouse-bins': [
    { name: 'code', label: 'Location code', generated: true },
    { name: 'name', label: 'Location name', required: true },
    { name: 'warehouse_id', label: 'Warehouse', kind: 'select', source: 'warehouses', required: true },
    { name: 'zone', label: 'Zone' },
    { name: 'rack', label: 'Rack' },
    { name: 'shelf', label: 'Shelf' },
    { name: 'bin', label: 'Bin' },
    status(),
  ],
  warranties: [
    { name: 'number', label: 'Warranty number', generated: true },
    { name: 'customer_id', label: 'Customer', kind: 'select', source: 'customers' },
    { name: 'product_id', label: 'Product', kind: 'select', source: 'products' },
    { name: 'inventory_unit_id', label: 'Serialized unit', kind: 'select', source: 'inventory-units' },
    { name: 'warranty_months', label: 'Warranty period (months)', kind: 'number', required: true },
    status(['active', 'expired', 'void']),
  ],
}

export function catalogLabel(source: string, row: Record<string, unknown>): string {
  if (source === 'customers') return `${row.customer_code} — ${row.name}`
  if (source === 'suppliers') return `${row.supplier_code} — ${row.company_name}`
  if (source === 'products') return `${row.sku} — ${row.name}`
  if (source === 'warehouses') return `${row.code} — ${row.name}`
  if (source === 'inventory-units') return String(row.serial_number || row.imei || row.id)
  return String(row.name || row.number || row.code || row.id)
}
