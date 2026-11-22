<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['method' => ['required', 'in:cash,card,bank_transfer,e_wallet'], 'reference' => ['nullable', 'string', 'max:255']];
    }
}
