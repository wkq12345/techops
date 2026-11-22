<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GoodsReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['notes' => ['nullable', 'string'], 'items' => ['required', 'array', 'min:1'], 'items.*.purchase_order_item_id' => ['required', 'exists:purchase_order_items,id'], 'items.*.bin_id' => ['nullable', 'integer', 'exists:warehouse_bins,id'], 'items.*.quantity' => ['required', 'numeric', 'gt:0'], 'items.*.serials' => ['sometimes', 'array'], 'items.*.serials.*' => ['string', 'distinct']];
    }
}
