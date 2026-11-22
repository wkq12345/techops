<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class PcBuild extends DomainModel
{
    public function items(): HasMany
    {
        return $this->hasMany(PcBuildItem::class);
    }

    public function requirement(): HasOne
    {
        return $this->hasOne(PcBuildRequirement::class);
    }
}
