<?php

namespace App\Models;

class GoodsReceiptItem extends DomainModel
{
    protected function casts(): array
    {
        return ['serials' => 'array'];
    }
}
