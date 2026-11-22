<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StockTransferRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['product_id' => ['required', 'exists:products,id'], 'from_warehouse_id' => ['required', 'exists:warehouses,id'], 'to_warehouse_id' => ['required', 'exists:warehouses,id'], 'from_bin_id' => ['nullable', 'integer', 'exists:warehouse_bins,id'], 'to_bin_id' => ['nullable', 'integer', 'exists:warehouse_bins,id'], 'quantity' => ['required', 'numeric', 'gt:0']];
    }
}
