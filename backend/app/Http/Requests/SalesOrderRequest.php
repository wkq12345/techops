<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalesOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            // Retain the old API contract as a fallback for legacy clients.
            'warehouse_id' => ['nullable', 'integer', Rule::exists('warehouses', 'id')->where('status', 'active')],
            'tax_rate' => ['sometimes', 'numeric', 'between:0,1'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.warehouse_id' => ['nullable', 'integer', Rule::exists('warehouses', 'id')->where('status', 'active')],
            'items.*.bin_id' => ['nullable', 'integer', 'exists:warehouse_bins,id'],
            'items.*.inventory_unit_id' => ['nullable', 'integer', 'exists:inventory_units,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
        ];
    }

    public function attributes(): array
    {
        return ['warehouse_id' => 'warehouse', 'items.*.warehouse_id' => 'item warehouse', 'items.*.bin_id' => 'item inventory location'];
    }
}
