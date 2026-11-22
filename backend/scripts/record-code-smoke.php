<?php

use App\Services\DomainResourceService;
use Illuminate\Support\Facades\DB;

// Exercise the real PostgreSQL implementation without committing test records.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

if (! $app->environment('local', 'testing') || DB::connection()->getDriverName() !== 'pgsql') {
    throw new RuntimeException('Run this check only against the local PostgreSQL development backend.');
}

$resources = app(DomainResourceService::class);
$definitions = [
    'customers' => ['customer_code', 'CUS', ['name' => 'Code smoke check']],
    'suppliers' => ['supplier_code', 'SUP', ['company_name' => 'Code smoke check']],
    'products' => ['sku', 'PRD', ['name' => 'Code smoke check', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 0, 'selling_price' => 0]],
    'warehouses' => ['code', 'WH', ['name' => 'Code smoke check']],
    'warehouse-bins' => ['code', 'BIN', ['zone' => 'Code smoke check']],
    'warranties' => ['number', 'WAR', ['warranty_start' => '2026-10-07', 'warranty_end' => '2027-10-07', 'warranty_type' => 'standard']],
    'warranty-claims' => ['number', 'WCL', ['issue' => 'Code smoke check']],
];
$beforeCounters = DB::table('record_code_sequences')->orderBy('resource')->get()->toJson();
$created = [];
DB::beginTransaction();
try {
    foreach ($definitions as $resource => [$field, $prefix, $data]) {
        if ($resource === 'warehouse-bins') {
            $data['warehouse_id'] = $created['warehouses']->id;
        }
        if ($resource === 'warranty-claims') {
            $data['warranty_id'] = $created['warranties']->id;
        }
        $first = $resources->create($resource, $data);
        $second = $resources->create($resource, $data);
        if (! preg_match('/^'.$prefix.'-\d{6,}$/', $first->{$field}) || $first->{$field} === $second->{$field}) {
            throw new RuntimeException('Generated codes failed the format or uniqueness check.');
        }
        $updated = $resources->update($resource, $first->id, [$field => 'MANUAL']);
        if ($updated->{$field} !== $first->{$field}) {
            throw new RuntimeException('An assigned code was changed.');
        }
        $created[$resource] = $first;
    }
} finally {
    DB::rollBack();
}
if ($beforeCounters !== DB::table('record_code_sequences')->orderBy('resource')->get()->toJson()) {
    throw new RuntimeException('The smoke check did not restore the counter state.');
}
echo "All seven PostgreSQL code generators and immutable updates passed; test records and counter allocations rolled back.\n";
