<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['product_id' => ['required', 'exists:products,id'], 'warehouse_id' => ['required', 'exists:warehouses,id'], 'bin_id' => ['nullable', 'integer', 'exists:warehouse_bins,id'], 'quantity_delta' => ['required', 'numeric', 'not_in:0'], 'reason' => ['required', 'string', 'max:1000']];
    }
}
