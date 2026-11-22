<?php

namespace App\Services;

use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Payment;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\RepairJob;
use App\Models\SalesOrder;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function __construct(private readonly OperationsCache $cache) {}

    public function dashboard(): array
    {
        return $this->cache->remember('dashboard', [], config('operations-cache.dashboard_ttl'), fn () => $this->calculateDashboard());
    }

    private function calculateDashboard(): array
    {
        return [
            'sales' => ['revenue' => (float) Payment::query()->where('status', 'completed')->sum('amount'), 'orders' => SalesOrder::query()->count(), 'completed' => SalesOrder::query()->where('status', 'completed')->count()],
            'inventory' => ['quantity_value' => (float) InventoryStock::query()->join('products', 'products.id', '=', 'inventory_stock.product_id')->selectRaw('coalesce(sum(inventory_stock.quantity * products.cost_price),0) value')->value('value'), 'serialized_available' => InventoryUnit::query()->where('status', 'available')->count(), 'low_stock' => InventoryStock::query()->join('products', 'products.id', '=', 'inventory_stock.product_id')->whereColumn(DB::raw('inventory_stock.quantity - inventory_stock.reserved_quantity'), '<', 'products.reorder_level')->count()],
            'repairs' => ['total' => RepairJob::query()->count(), 'active' => RepairJob::query()->whereNotIn('status', ['completed', 'cancelled'])->count(), 'revenue' => (float) RepairJob::query()->where('status', 'completed')->sum('final_cost')],
            'purchasing' => ['spend' => (float) PurchaseOrder::query()->whereIn('status', ['ordered', 'partially_received', 'received'])->sum('total'), 'outstanding' => PurchaseOrder::query()->whereNotIn('status', ['received', 'cancelled'])->count()],
            'top_products' => Product::query()->leftJoin('sales_order_items', 'products.id', '=', 'sales_order_items.product_id')->select('products.id', 'products.name')->selectRaw('coalesce(sum(sales_order_items.quantity),0) sold')->groupBy('products.id', 'products.name')->orderByDesc('sold')->limit(5)->get(),
        ];
    }
}
