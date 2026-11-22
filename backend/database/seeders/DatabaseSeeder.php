<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        DB::transaction(function (): void {
            $permissions = collect([
                'products.view', 'products.create', 'products.update',
                'inventory.view', 'inventory.adjust', 'inventory.transfer',
                'sales.create', 'sales.approve',
                'repairs.view', 'repairs.update', 'repairs.assign',
                'purchases.create', 'purchases.approve',
                'reports.view', 'users.manage',
            ])->mapWithKeys(function (string $name): array {
                $permission = Permission::query()->updateOrCreate(
                    ['name' => $name],
                    ['description' => str($name)->replace('.', ' ')->headline()],
                );

                return [$name => $permission->id];
            });

            $rolePermissions = [
                'super-admin' => $permissions->values()->all(),
                'manager' => $permissions->except('users.manage')->values()->all(),
                'sales-staff' => $permissions->only(['products.view', 'inventory.view', 'sales.create', 'repairs.view'])->values()->all(),
                'technician' => $permissions->only(['products.view', 'inventory.view', 'repairs.view', 'repairs.update'])->values()->all(),
                'warehouse-staff' => $permissions->only(['products.view', 'inventory.view', 'inventory.adjust', 'inventory.transfer'])->values()->all(),
                'purchasing-staff' => $permissions->only(['products.view', 'inventory.view', 'purchases.create'])->values()->all(),
            ];

            foreach ($rolePermissions as $slug => $permissionIds) {
                $role = Role::query()->updateOrCreate(
                    ['slug' => $slug],
                    ['name' => str($slug)->replace('-', ' ')->title()],
                );
                $role->permissions()->sync($permissionIds);
            }

            $admin = User::query()->firstOrCreate(
                ['email' => env('ADMIN_EMAIL', 'admin@techops.local')],
                [
                    'name' => env('ADMIN_NAME', 'TechOps Administrator'),
                    'password' => env('ADMIN_PASSWORD', 'ChangeMe123!'),
                    'email_verified_at' => now(),
                ],
            );
            $admin->roles()->sync([Role::query()->where('slug', 'super-admin')->valueOrFail('id')]);
        });

        $this->call(DemoDataSeeder::class);
    }
}
