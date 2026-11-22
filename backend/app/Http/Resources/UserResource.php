<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('roles.permissions');
        $permissions = $this->roles->flatMap->permissions->pluck('name')->unique();
        if ($this->resource->isAdministrator()) {
            $permissions = $permissions->merge(['users.manage', 'records.delete']);
        } else {
            $permissions = $permissions->reject(fn ($name) => in_array($name, ['users.manage', 'records.delete'], true));
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->roles->pluck('slug')->values(),
            'permissions' => $permissions->unique()->sort()->values(),
        ];
    }
}
