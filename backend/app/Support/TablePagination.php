<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class TablePagination
{
    // Only public table columns can be requested; never accept SQL from the client.
    private const COLUMNS = [
        'users' => ['name', 'email', 'role'],
        'categories' => ['name', 'parent', 'products_count', 'children_count', 'status'],
        'brands' => ['name', 'products_count', 'status'],
        'customers' => ['customer_code', 'name', 'email', 'phone'],
        'suppliers' => ['supplier_code', 'company_name', 'contact_person', 'status'],
        'products' => ['sku', 'name', 'product_type', 'tracking_type', 'cost_price', 'selling_price', 'reorder_level', 'status'],
        'warehouses' => ['code', 'name', 'address', 'status'],
        'warehouse-bins' => ['code', 'name', 'warehouse_name', 'stocks_count', 'status'],
        'inventory' => ['sku', 'product_name', 'warehouse_name', 'location_name', 'quantity', 'reserved_quantity', 'available_quantity', 'availability'],
        'inventory-units' => ['serial_number', 'imei', 'product_name', 'warehouse_name', 'location_name', 'status'],
        'stock-movements' => ['created_at', 'product_name', 'warehouse_name', 'location_name', 'movement_type', 'quantity'],
        'sales-orders' => ['number', 'customer_name', 'status', 'total', 'created_at'],
        'invoices' => ['number', 'sales_order_number', 'customer_name', 'issued_at', 'total', 'status'],
        'repairs' => ['number', 'customer_name', 'technician_name', 'status', 'estimated_cost'],
        'purchase-orders' => ['number', 'supplier_name', 'status', 'total', 'expected_at'],
        'goods-receipts' => ['number', 'purchase_order_number', 'warehouse_name', 'received_at'],
        'pc-builds' => ['number', 'customer_name', 'status', 'budget', 'estimated_total'],
        'warranties' => ['number', 'customer_name', 'warranty_start', 'warranty_end', 'status'],
        'sales-returns' => ['number', 'sales_order_number', 'customer_name', 'status', 'created_at'],
        'audit-logs' => ['created_at', 'action', 'entity_type', 'user_name'],
    ];

    public static function paginate(Builder $query, string $resource, array $options = [], int $perPage = 30): CursorPaginator|LengthAwarePaginator
    {
        $perPage = max(1, min(100, $perPage));
        // Catalog selectors and other existing consumers retain their cursor contract.
        if (!array_key_exists('sort_by', $options)) {
            return $query->cursorPaginate($perPage);
        }

        $validated = Validator::make($options, [
            'sort_by' => ['required', 'string', Rule::in(['id', ...(self::COLUMNS[$resource] ?? [])])],
            'sort_direction' => ['sometimes', 'string', Rule::in(['asc', 'desc'])],
            'page' => ['sometimes', 'integer', 'min:1'],
        ])->validate();
        $key = $validated['sort_by'];
        $direction = $validated['sort_direction'] ?? 'asc';
        $column = match ($key) {
            'parent' => 'parent_name',
            'role' => 'role_sort',
            'customer_name', 'product_name', 'warehouse_name', 'location_name', 'technician_name', 'supplier_name', 'sales_order_number', 'purchase_order_number', 'user_name', 'products_count', 'children_count', 'stocks_count', 'available_quantity', 'availability' => $key,
            'sku' => $resource === 'inventory' ? 'products.sku' : $query->getModel()->qualifyColumn($key),
            default => $query->getModel()->qualifyColumn($key),
        };
        $query->reorder()->orderBy($column, $direction);
        if ($key !== 'id') $query->orderBy($query->getModel()->getQualifiedKeyName(), $direction);

        // Numbered pages support nullable and aggregate sort values without losing rows.
        return $query->paginate($perPage, ['*'], 'page', (int) ($validated['page'] ?? 1))
            ->withQueryString()
            ->appends(['sort_by' => $key, 'sort_direction' => $direction, 'per_page' => $perPage]);
    }
}
