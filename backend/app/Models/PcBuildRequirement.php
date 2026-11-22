<?php

namespace App\Models;

class PcBuildRequirement extends DomainModel
{
    protected function casts(): array
    {
        return ['requirements' => 'array'];
    }
}
