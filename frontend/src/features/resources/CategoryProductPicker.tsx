import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { apiClient } from '../../services/api-client'

interface Page<T> { data: T[]; next_cursor?: string | null }
interface Category { id: number; name: string; parent_id?: number | null; status?: string }
export interface ProductOption { id: number; name: string; sku: string; category_id?: number | null; status: string; tracking_type: string; selling_price: string }

function categoryLabel(category: Category, categories: Map<number, Category>): string {
  const names = [category.name]
  const visited = new Set([category.id])
  let parent = categories.get(Number(category.parent_id))
  while (parent && !visited.has(parent.id)) {
    names.unshift(parent.name); visited.add(parent.id)
    parent = categories.get(Number(parent.parent_id))
  }
  return names.join(' / ')
}

export function CategoryProductPicker({ categoryId, productId, onCategoryChange, onProductChange, disabled = false }: {
  categoryId: string
  productId: string
  onCategoryChange: (value: string) => void
  onProductChange: (product: ProductOption | undefined) => void
  disabled?: boolean
}) {
  const categories = useQuery({
    queryKey: ['catalog', 'product-categories'],
    queryFn: async () => {
      const rows: Category[] = []
      let cursor: string | null = null
      do {
        const response: Page<Category> = (await apiClient.get<Page<Category>>('/api/v1/categories', { params: { per_page: 100, cursor: cursor || undefined } })).data
        rows.push(...response.data); cursor = response.next_cursor ?? null
      } while (cursor)
      return rows
    },
  })
  const [search, setSearch] = useState('')
  const products = useInfiniteQuery({
    queryKey: ['catalog', 'products', 'by-category', categoryId, search],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => (await apiClient.get<Page<ProductOption>>('/api/v1/products', { params: { per_page: 100, category_id: categoryId || undefined, status: 'active', search: search || undefined, cursor: pageParam || undefined } })).data,
    getNextPageParam: last => last.next_cursor ?? undefined,
  })
  const categoryMap = new Map((categories.data ?? []).map(category => [category.id, category]))
  const options = [...new Map((products.data?.pages.flatMap(page => page.data) ?? []).filter(product => product.status === 'active').map(product => [product.id, product])).values()]
  useEffect(() => {
    const scanned = options.find(product => product.sku.toLocaleLowerCase() === search.trim().toLocaleLowerCase())
    if (scanned && String(scanned.id) !== productId) onProductChange(scanned)
  }, [options, search, productId, onProductChange])

  return <>
    <Field label="Category"><select value={categoryId} onChange={event => { setSearch(''); onCategoryChange(event.target.value) }} disabled={disabled || categories.isLoading || categories.isError}>
      <option value="">All categories</option>
      {(categories.data ?? []).filter(category => category.status !== 'inactive').map(category => <option key={category.id} value={category.id}>{categoryLabel(category, categoryMap)}</option>)}
    </select></Field>
    <div className="product-picker">
      <Field label="Search or scan SKU / barcode"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Scan barcode or search products" disabled={disabled} /></Field>
      <Field label="Product" required><select value={productId} onChange={event => onProductChange(options.find(product => String(product.id) === event.target.value))} required disabled={disabled || products.isLoading || products.isError}>
        <option value="">{products.isLoading ? 'Loading products…' : options.length ? 'Select product' : 'No active products in this category'}</option>
        {options.map(product => <option key={product.id} value={product.id}>{product.sku} — {product.name} ({new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(Number(product.selling_price))})</option>)}
      </select></Field>
      {(categories.isError || products.isError) && <div className="picker-feedback" role="alert">{products.isError ? 'Could not load products.' : 'Could not load categories; all products remain available.'}<Button size="small" onClick={() => { if (categories.isError) void categories.refetch(); if (products.isError) void products.refetch() }}>Retry</Button></div>}
      {products.hasNextPage && <Button size="small" variant="ghost" onClick={() => void products.fetchNextPage()} disabled={disabled || products.isFetchingNextPage}>{products.isFetchingNextPage ? 'Loading…' : 'Load more products'}</Button>}
    </div>
  </>
}
