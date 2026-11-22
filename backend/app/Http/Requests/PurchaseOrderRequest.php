<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['supplier_id' => ['required', 'exists:suppliers,id'], 'warehouse_id' => ['required', 'exists:warehouses,id'], 'expected_at' => ['nullable', 'date'], 'notes' => ['nullable', 'string'], 'items' => ['required', 'array', 'min:1'], 'items.*.product_id' => ['required', 'exists:products,id'], 'items.*.quantity' => ['required', 'numeric', 'gt:0'], 'items.*.unit_cost' => ['required', 'numeric', 'min:0']];
    }
}
