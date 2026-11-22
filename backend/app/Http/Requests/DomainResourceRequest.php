<?php

namespace App\Http\Requests;

use App\Services\RecordCodeService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DomainResourceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $id = $this->route('id');

        $resource = (string) $this->route('resource');
        $warrantyMonths = $id ? ['sometimes', 'required', 'integer', 'min:1', 'max:1200'] : ['required', 'integer', 'min:1', 'max:1200'];
        $rules = match ($resource) {
            'customers' => ['name' => ['required', 'string', 'max:255'], 'email' => ['nullable', 'email'], 'phone' => ['nullable', 'string', 'max:50'], 'address' => ['nullable', 'string'], 'notes' => ['nullable', 'string']],
            'suppliers' => ['company_name' => ['required', 'string', 'max:255'], 'contact_person' => ['nullable', 'string'], 'email' => ['nullable', 'email'], 'phone' => ['nullable', 'string'], 'address' => ['nullable', 'string'], 'notes' => ['nullable', 'string'], 'status' => ['sometimes', Rule::in(['active', 'inactive'])]],
            'brands' => ['name' => ['required', 'string', 'max:255', Rule::unique('brands')->ignore($id)], 'slug' => ['prohibited'], 'status' => ['sometimes', Rule::in(['active', 'inactive'])]],
            'categories' => ['parent_id' => ['nullable', 'integer', 'exists:categories,id'], 'name' => ['required', 'string', 'max:255'], 'slug' => ['prohibited'], 'status' => ['sometimes', Rule::in(['active', 'inactive'])]],
            'attributes' => ['name' => ['required', 'string'], 'slug' => ['required', 'string', Rule::unique('attributes')->ignore($id)], 'data_type' => ['required', Rule::in(['text', 'number', 'boolean'])], 'unit' => ['nullable', 'string']],
            'products' => ['name' => ['required', 'string'], 'category_id' => ['nullable', 'exists:categories,id'], 'brand_id' => ['nullable', 'exists:brands,id'], 'product_type' => ['required', Rule::in(['physical', 'serialized', 'service'])], 'tracking_type' => ['required', Rule::in(['none', 'quantity', 'serial', 'imei'])], 'cost_price' => ['required', 'numeric', 'min:0'], 'selling_price' => ['required', 'numeric', 'min:0'], 'warranty_months' => ['integer', 'min:0'], 'reorder_level' => ['numeric', 'min:0'], 'status' => ['sometimes', Rule::in(['active', 'inactive'])], 'description' => ['nullable', 'string']],
            'warehouses' => ['name' => ['required', 'string'], 'address' => ['nullable', 'string'], 'status' => ['sometimes', Rule::in(['active', 'inactive'])]],
            'warehouse-bins' => ['name' => ['required', 'string', 'max:255'], 'status' => ['sometimes', Rule::in(['active', 'inactive'])], 'is_unassigned' => ['prohibited'], 'warehouse_id' => ['required', 'exists:warehouses,id'], 'zone' => ['nullable', 'string'], 'rack' => ['nullable', 'string'], 'shelf' => ['nullable', 'string'], 'bin' => ['nullable', 'string']],
            'warranties' => ['customer_id' => ['nullable', 'exists:customers,id'], 'product_id' => ['nullable', 'exists:products,id'], 'inventory_unit_id' => ['nullable', 'exists:inventory_units,id'], 'reference_type' => ['nullable', 'string'], 'reference_id' => ['nullable', 'integer'], 'warranty_months' => $warrantyMonths, 'status' => ['sometimes', Rule::in(['active', 'expired', 'void'])]],
            'warranty-claims' => ['warranty_id' => ['required', 'exists:warranties,id'], 'status' => ['sometimes', 'string'], 'issue' => ['required', 'string'], 'resolution' => ['nullable', 'string'], 'repair_job_id' => ['nullable', 'exists:repair_jobs,id']],
            default => [],
        };

        if ($field = RecordCodeService::field($resource)) {
            $rules[$field] = ['prohibited'];
        }

        return $rules;
    }
}
