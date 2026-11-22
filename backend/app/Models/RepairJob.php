<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepairJob extends DomainModel
{
    public function device(): HasOne
    {
        return $this->hasOne(RepairDevice::class);
    }

    public function parts(): HasMany
    {
        return $this->hasMany(RepairPart::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(RepairStatusHistory::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
