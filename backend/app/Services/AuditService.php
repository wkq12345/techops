<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

class AuditService
{
    public function record(string $action, Model $entity, ?array $oldValues = null, ?array $newValues = null): AuditLog
    {
        return AuditLog::query()->create([
            'user_id' => auth()->id(), 'action' => $action,
            'entity_type' => $entity->getMorphClass(), 'entity_id' => $entity->getKey(),
            'old_values' => $oldValues, 'new_values' => $newValues,
            'ip_address' => request()->ip(), 'user_agent' => request()->userAgent(), 'created_at' => now(),
        ]);
    }
}
