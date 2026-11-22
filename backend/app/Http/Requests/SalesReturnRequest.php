<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SalesReturnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['sales_order_id' => ['required', 'exists:sales_orders,id'], 'warehouse_id' => ['required', 'exists:warehouses,id'], 'bin_id' => ['nullable', 'integer', 'exists:warehouse_bins,id'], 'notes' => ['nullable', 'string'], 'items' => ['required', 'array', 'min:1'], 'items.*.sales_order_item_id' => ['required', 'exists:sales_order_items,id'], 'items.*.quantity' => ['required', 'numeric', 'gt:0'], 'items.*.reason' => ['required', 'in:defective,wrong_item,customer_change,warranty_claim,damaged'], 'items.*.disposition' => ['required', 'in:available,damaged,repair,supplier_return'], 'items.*.refund_amount' => ['required', 'numeric', 'min:0']];
    }
}
