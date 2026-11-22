<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesOrderItem extends DomainModel
{
    public function location(): BelongsTo
    {
        return $this->belongsTo(WarehouseBin::class, 'bin_id');
    }

    public function warehouse(): BelongsTo
    {
        return $this->belongsTo(Warehouse::class, 'warehouse_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
