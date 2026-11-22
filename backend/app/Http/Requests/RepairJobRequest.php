<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RepairJobRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['customer_id' => ['required', 'exists:customers,id'], 'technician_id' => ['nullable', 'exists:users,id'], 'estimated_cost' => ['nullable', 'numeric', 'min:0'], 'device' => ['required', 'array'], 'device.device_type' => ['required', 'string'], 'device.brand' => ['nullable', 'string'], 'device.model' => ['nullable', 'string'], 'device.serial_number' => ['nullable', 'string'], 'device.imei' => ['nullable', 'string'], 'device.reported_problem' => ['required', 'string'], 'device.accessories_received' => ['nullable', 'string'], 'device.physical_condition' => ['nullable', 'string']];
    }
}
