<?php

// This file is mounted only into the isolated learning bootstrap Job.
require '/app/vendor/autoload.php';
$app = require '/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    if (config('database.default') !== 'pgsql'
        || config('database.connections.pgsql.host') !== 'postgres'
        || config('database.connections.pgsql.database') !== 'techops_learning') {
        throw new RuntimeException('Refusing bootstrap outside the isolated PostgreSQL learning database.');
    }

    $seed = getenv('SEED_INITIAL_DATA') === 'true';
    if ($seed && ((Schema::hasTable('users') && DB::table('users')->exists())
        || (Schema::hasTable('products') && DB::table('products')->exists()))) {
        throw new RuntimeException('Initial data already exists without an initialization marker. Inspect the previous bootstrap Job; refusing to reseed.');
    }

    $run = static function (string $command): void {
        $status = Artisan::call($command, ['--force' => true, '--no-interaction' => true]);
        fwrite(STDOUT, Artisan::output());
        if ($status !== 0) {
            throw new RuntimeException($command.' failed.');
        }
    };

    $run('migrate');
    if ($seed) {
        // Roll back all demo/admin seeding together if any seeder fails.
        DB::transaction(static function () use ($run): void {
            $run('db:seed');
            // Older demo seeds create warehouse totals after the location migration.
            // Give only this brand-new learning data matching child-location balances.
            $locations = app(App\Services\InventoryLocationService::class);
            foreach (App\Models\Warehouse::query()->get() as $warehouse) {
                $bin = $locations->unassigned($warehouse->id);
                foreach (App\Models\InventoryStock::query()->where('warehouse_id', $warehouse->id)->get() as $stock) {
                    App\Models\InventoryLocationStock::query()->firstOrCreate(
                        ['product_id' => $stock->product_id, 'bin_id' => $bin->id],
                        ['warehouse_id' => $warehouse->id, 'quantity' => $stock->quantity, 'reserved_quantity' => $stock->reserved_quantity],
                    );
                }
            }
            foreach (App\Models\WarehouseBin::query()->whereNull('name')->get() as $bin) {
                $bin->update(['name' => $bin->code]);
            }
        });
    }
    fwrite(STDOUT, $seed ? "Learning database initialized.\n" : "Migrations complete; demo seeding skipped.\n");
} catch (Throwable $exception) {
    // Do not echo connection DSNs or credentials from database exceptions.
    if ($exception::class === RuntimeException::class) {
        fwrite(STDERR, $exception->getMessage().PHP_EOL);
    }
    fwrite(STDERR, 'Bootstrap failed ('.$exception::class.'). Check the database readiness and migration/seed output above. No reset was attempted.'.PHP_EOL);
    exit(1);
}
