<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends DomainModel
{
    public function salesOrder(): BelongsTo
    {
        return $this->belongsTo(SalesOrder::class);
    }
}
