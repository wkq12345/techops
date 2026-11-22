<?php

use App\Services\RecordCodeService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('warehouse_bins', function (Blueprint $table): void {
            $table->string('name')->nullable();
            $table->string('status')->default('active')->index();
            $table->boolean('is_unassigned')->default(false);
        });
        DB::statement('create unique index warehouse_unassigned_location_unique on warehouse_bins (warehouse_id) where is_unassigned = true');

        DB::table('warehouse_bins')->orderBy('id')->chunkById(100, function ($locations): void {
            foreach ($locations as $location) {
                $name = collect([$location->zone, $location->rack, $location->shelf, $location->bin])->filter()->implode(' / ');
                DB::table('warehouse_bins')->where('id', $location->id)->update(['name' => $name ?: $location->code]);
            }
        });
        $defaults = [];
        foreach (DB::table('warehouses')->orderBy('id')->get() as $warehouse) {
            $defaults[$warehouse->id] = DB::table('warehouse_bins')->insertGetId([
                'warehouse_id' => $warehouse->id, 'code' => app(RecordCodeService::class)->next('warehouse-bins'),
                'name' => 'Unassigned', 'status' => 'active', 'is_unassigned' => true, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        Schema::create('inventory_location_stock', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('bin_id')->constrained('warehouse_bins')->restrictOnDelete();
            $table->decimal('quantity', 14, 3)->default(0);
            $table->decimal('reserved_quantity', 14, 3)->default(0);
            $table->timestamps();
            $table->unique(['product_id', 'bin_id']);
            $table->index(['warehouse_id', 'product_id']);
        });
        DB::table('inventory_stock')->orderBy('id')->chunkById(100, function ($stocks) use ($defaults): void {
            foreach ($stocks as $stock) {
                DB::table('inventory_location_stock')->insert([
                    'product_id' => $stock->product_id, 'warehouse_id' => $stock->warehouse_id, 'bin_id' => $defaults[$stock->warehouse_id],
                    'quantity' => $stock->quantity, 'reserved_quantity' => $stock->reserved_quantity,
                    'created_at' => $stock->created_at, 'updated_at' => $stock->updated_at,
                ]);
            }
        });
        foreach ($defaults as $warehouseId => $binId) {
            DB::table('inventory_units')->where('warehouse_id', $warehouseId)->whereNull('bin_id')->update(['bin_id' => $binId]);
        }

        foreach (['sales_order_items', 'stock_movements', 'stock_adjustments', 'goods_receipt_items', 'repair_parts', 'sales_return_items'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->foreignId('bin_id')->nullable()->constrained('warehouse_bins')->restrictOnDelete();
                $table->index('bin_id');
            });
        }
        foreach ($defaults as $warehouseId => $binId) {
            foreach (['sales_order_items', 'stock_movements', 'stock_adjustments'] as $tableName) {
                DB::table($tableName)->where('warehouse_id', $warehouseId)->whereNull('bin_id')->update(['bin_id' => $binId]);
            }
            DB::table('goods_receipt_items')->whereIn('goods_receipt_id', DB::table('goods_receipts')->where('warehouse_id', $warehouseId)->select('id'))->update(['bin_id' => $binId]);
        }
        // Preserve a reserved serialized unit's known bin for orders still awaiting fulfilment.
        DB::table('sales_order_items')->whereNotNull('inventory_unit_id')
            ->whereIn('sales_order_id', DB::table('sales_orders')->whereIn('status', ['confirmed', 'processing'])->select('id'))
            ->orderBy('id')->chunkById(100, function ($items): void {
                foreach ($items as $item) {
                    $unit = DB::table('inventory_units')->where('id', $item->inventory_unit_id)
                        ->where('warehouse_id', $item->warehouse_id)->where('product_id', $item->product_id)->where('status', 'reserved')->first();
                    if ($unit && $unit->bin_id) DB::table('sales_order_items')->where('id', $item->id)->update(['bin_id' => $unit->bin_id]);
                }
            });
    }

    public function down(): void
    {
        throw new RuntimeException('Removing warehouse location balances or history requires explicit approval.');
    }
};
