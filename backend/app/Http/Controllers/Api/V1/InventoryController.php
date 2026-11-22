<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StockAdjustmentRequest;
use App\Http\Requests\StockTransferRequest;
use App\Models\InventoryLocationStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\WarehouseBin;
use App\Services\InventoryService;
use App\Support\TablePagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function __construct(private readonly InventoryService $inventory) {}

    public function index(Request $request): JsonResponse
    {
        $query = InventoryLocationStock::query()->join('products', 'products.id', '=', 'inventory_location_stock.product_id')
            ->join('warehouses', 'warehouses.id', '=', 'inventory_location_stock.warehouse_id')
            ->join('warehouse_bins', 'warehouse_bins.id', '=', 'inventory_location_stock.bin_id')
            ->select('inventory_location_stock.*', 'products.name as product_name', 'products.sku', 'warehouses.name as warehouse_name', 'warehouse_bins.name as location_name')
            ->selectRaw('(inventory_location_stock.quantity - inventory_location_stock.reserved_quantity) as available_quantity')
            ->selectRaw("case when inventory_location_stock.quantity - inventory_location_stock.reserved_quantity > 0 then 'available' when inventory_location_stock.quantity > 0 then 'fully_reserved' else 'out_of_stock' end as availability")
            ->orderBy('products.name');
        $rows = TablePagination::paginate($query, 'inventory', $request->only(['sort_by', 'sort_direction', 'page']), $request->integer('per_page', 50));

        return response()->json($rows);
    }

    public function replenishmentSuggestions(): JsonResponse
    {
        $products = Product::query()->where('status', 'active')->where('tracking_type', '<>', 'none')
            ->where('reorder_level', '>', 0)->orderBy('name')->limit(500)->get(['id', 'sku', 'name', 'tracking_type', 'reorder_level', 'cost_price']);
        $trackedIds = $products->whereNotIn('tracking_type', ['serial', 'imei'])->pluck('id');
        $quantityStock = InventoryLocationStock::query()->whereIn('product_id', $trackedIds)->selectRaw('product_id, COALESCE(SUM(quantity - reserved_quantity), 0) as available')->groupBy('product_id')->pluck('available', 'product_id');
        $unitStock = InventoryUnit::query()->whereIn('product_id', $products->whereIn('tracking_type', ['serial', 'imei'])->pluck('id'))
            ->where('status', 'available')->selectRaw('product_id, count(*) as available')->groupBy('product_id')->pluck('available', 'product_id');
        $rows = $products->map(function (Product $product) use ($quantityStock, $unitStock): ?array {
            $available = (float) (in_array($product->tracking_type, ['serial', 'imei'], true) ? $unitStock->get($product->id, 0) : $quantityStock->get($product->id, 0));
            $reorder = (float) $product->reorder_level;
            if ($available >= $reorder) return null;
            return ['id' => $product->id, 'sku' => $product->sku, 'name' => $product->name, 'available_quantity' => $available, 'reorder_level' => $reorder, 'suggested_quantity' => round($reorder - $available, 3), 'unit_cost' => (float) $product->cost_price];
        })->filter()->values();
        return response()->json(['data' => $rows]);
    }

    public function adjust(StockAdjustmentRequest $r): JsonResponse
    {
        $d = $r->validated();
        $a = $this->inventory->adjust($d['product_id'], $d['warehouse_id'], $d['quantity_delta'], $d['reason'], $d['bin_id'] ?? null);

        return response()->json(['data' => $a, 'message' => 'Stock adjusted.'], 201);
    }

    public function locations(Request $request, Product $product): JsonResponse
    {
        $filters = $request->validate(['warehouse_id' => ['required', 'integer', 'exists:warehouses,id']]);
        $query = WarehouseBin::query()->join('warehouses', 'warehouses.id', '=', 'warehouse_bins.warehouse_id')
            ->where('warehouses.status', 'active')->where('warehouse_bins.status', 'active')
            ->where('warehouse_bins.warehouse_id', $filters['warehouse_id'])
            ->select('warehouse_bins.id', 'warehouse_bins.code', 'warehouse_bins.name', 'warehouse_bins.warehouse_id', 'warehouse_bins.status', 'warehouses.name as warehouse_name')
            ->orderBy('warehouse_bins.id');

        if (in_array($product->tracking_type, ['serial', 'imei'], true)) {
            $units = InventoryUnit::query()->where('product_id', $product->id)->where('status', 'available')
                ->select('bin_id')->selectRaw('count(*) as available_quantity')->groupBy('bin_id');
            $query->leftJoinSub($units, 'available_units', 'available_units.bin_id', '=', 'warehouse_bins.id')
                ->selectRaw('coalesce(available_units.available_quantity, 0) as available_quantity');
        } elseif ($product->tracking_type === 'none') {
            $query->selectRaw('null as available_quantity');
        } else {
            $query->leftJoin('inventory_location_stock', function ($join) use ($product): void {
                $join->on('inventory_location_stock.bin_id', '=', 'warehouse_bins.id')->where('inventory_location_stock.product_id', $product->id);
            })->selectRaw('coalesce(inventory_location_stock.quantity - inventory_location_stock.reserved_quantity, 0) as available_quantity');
        }

        return response()->json($query->cursorPaginate(max(1, min(100, $request->integer('per_page', 100))))->withQueryString());
    }

    public function transfer(StockTransferRequest $r): JsonResponse
    {
        $d = $r->validated();
        $this->inventory->transfer($d['product_id'], $d['from_warehouse_id'], $d['to_warehouse_id'], $d['quantity'], $d['from_bin_id'] ?? null, $d['to_bin_id'] ?? null);

        return response()->json(['data' => null, 'message' => 'Stock transferred.']);
    }
}
