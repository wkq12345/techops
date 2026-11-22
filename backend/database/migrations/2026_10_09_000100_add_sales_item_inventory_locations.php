<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_order_items', function (Blueprint $table): void {
            $table->foreignId('warehouse_id')->nullable()->constrained('warehouses')->restrictOnDelete();
            $table->index('warehouse_id');
        });

        // Existing orders retain their original stock location on every line.
        DB::table('sales_order_items')->whereNull('warehouse_id')->update([
            'warehouse_id' => DB::raw('(select warehouse_id from sales_orders where sales_orders.id = sales_order_items.sales_order_id)'),
        ]);

        Schema::table('sales_orders', function (Blueprint $table): void {
            // A mixed-location order has no single order-level stock location.
            $table->foreignId('warehouse_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Removing per-item inventory locations requires explicit approval.');
    }
};
