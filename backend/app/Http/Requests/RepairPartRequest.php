<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RepairPartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['product_id' => ['required', 'exists:products,id'], 'warehouse_id' => ['required', 'exists:warehouses,id'], 'bin_id' => ['nullable', 'integer', 'exists:warehouse_bins,id'], 'inventory_unit_id' => ['nullable', 'exists:inventory_units,id'], 'quantity' => ['required', 'numeric', 'gt:0']];
    }
}
