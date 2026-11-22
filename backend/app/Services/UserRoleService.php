<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\Role;

class UserRoleService
{
    public const OPERATIONAL_PERMISSIONS = [
        'products.view', 'products.create', 'products.update',
        'inventory.view', 'inventory.adjust', 'inventory.transfer',
        'sales.create', 'sales.approve', 'repairs.view', 'repairs.update', 'repairs.assign',
        'purchases.create', 'purchases.approve', 'reports.view',
    ];

    public function provision(): void
    {
        $permissions = collect([...self::OPERATIONAL_PERMISSIONS, 'users.manage'])
            ->mapWithKeys(function (string $name): array {
                $permission = Permission::query()->firstOrCreate(['name' => $name], ['description' => str($name)->replace('.', ' ')->headline()]);

                return [$name => $permission->id];
            });
        foreach (['admin' => 'Admin', 'staff' => 'Staff'] as $slug => $name) {
            $role = Role::query()->firstOrCreate(['slug' => $slug], ['name' => $name]);
            $role->permissions()->syncWithoutDetaching($slug === 'admin' ? $permissions->values()->all() : $permissions->except('users.manage')->values()->all());
        }
    }
}
