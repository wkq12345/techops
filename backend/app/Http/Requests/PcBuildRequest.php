<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PcBuildRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'number' => ['prohibited'],
            'status' => ['prohibited'],
            'sales_order_id' => ['prohibited'],
            'customer_id' => ['nullable', 'exists:customers,id'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'requirements' => ['sometimes', 'array'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'exists:products,id'],
            'items.*.component_type' => ['required', 'string', 'max:255', 'distinct:strict'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['prohibited'],
            'items.*.is_reserved' => ['prohibited'],
        ];
    }
}
