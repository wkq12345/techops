<?php

namespace App\Services;

use App\Models\InventoryLocationStock;
use App\Models\InventoryStock;
use App\Models\InventoryUnit;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function __construct(private readonly AuditService $audit, private readonly InventoryLocationService $locations) {}

    public function adjust(int $productId, int $warehouseId, float $delta, string $reason, ?int $binId = null): StockAdjustment
    {
        return DB::transaction(function () use ($productId, $warehouseId, $delta, $reason, $binId): StockAdjustment {
            $product = Product::query()->lockForUpdate()->findOrFail($productId);
            if ($product->tracking_type !== 'quantity') {
                throw ValidationException::withMessages(['product_id' => 'Serialized stock must be adjusted by unit.']);
            }
            $location = $this->locations->resolve($warehouseId, $binId);
            [$total, $stock] = $this->lockBalances($productId, $warehouseId, $location->id);
            if ((float) $stock->quantity + $delta < (float) $stock->reserved_quantity || (float) $total->quantity + $delta < (float) $total->reserved_quantity) {
                throw ValidationException::withMessages(['quantity' => 'Adjustment would reduce stock below the reserved quantity.']);
            }
            $stock->increment('quantity', $delta);
            $total->increment('quantity', $delta);
            $adjustment = StockAdjustment::query()->create(['product_id' => $productId, 'warehouse_id' => $warehouseId, 'bin_id' => $location->id, 'quantity_delta' => $delta, 'reason' => $reason, 'created_by' => auth()->id()]);
            $this->movement($productId, $warehouseId, $delta > 0 ? 'adjustment_in' : 'adjustment_out', $delta, $adjustment, $reason, null, $location->id);
            $this->audit->record('inventory.adjusted', $adjustment, null, $adjustment->toArray());
            if ((float) $total->fresh()->quantity - (float) $total->fresh()->reserved_quantity <= (float) $product->reorder_level) {
                app(NotificationService::class)->permission('inventory.view', 'Low stock', "{$product->name} has reached its reorder level.", 'low_stock', '/modules/inventory');
            }

            return $adjustment;
        }, 5);
    }

    public function receive(int $productId, int $warehouseId, float $quantity, float $cost, object $reference, array $serials = [], ?int $binId = null): void
    {
        $product = Product::query()->lockForUpdate()->findOrFail($productId);
        if ($product->tracking_type === 'none') return;
        $location = $this->locations->resolve($warehouseId, $binId);
        if (in_array($product->tracking_type, ['serial', 'imei'], true)) {
            if ($quantity <= 0 || floor($quantity) !== $quantity || count($serials) !== (int) $quantity) {
                throw ValidationException::withMessages(['serials' => 'A serial or IMEI is required for every whole unit received.']);
            }
            foreach ($serials as $identifier) {
                $unit = InventoryUnit::query()->create(['product_id' => $productId, 'warehouse_id' => $warehouseId, 'bin_id' => $location->id, $product->tracking_type === 'imei' ? 'imei' : 'serial_number' => $identifier, 'status' => 'available', 'cost_price' => $cost, 'received_at' => now()]);
                $this->movement($productId, $warehouseId, 'purchase_receive', 1, $reference, null, $unit->id, $location->id);
            }

            return;
        }
        [$total, $stock] = $this->lockBalances($productId, $warehouseId, $location->id);
        $stock->increment('quantity', $quantity);
        $total->increment('quantity', $quantity);
        $this->movement($productId, $warehouseId, 'purchase_receive', $quantity, $reference, null, null, $location->id);
    }

    public function reserve(int $productId, int $warehouseId, float $quantity, ?int $unitId = null, ?int $binId = null): void
    {
        $product = Product::query()->lockForUpdate()->findOrFail($productId);
        if ($product->tracking_type === 'none') return;
        if (in_array($product->tracking_type, ['serial', 'imei'], true)) {
            if ($quantity !== 1.0) throw ValidationException::withMessages(['quantity' => 'Select exactly one serialized unit per order line.']);
            $unit = InventoryUnit::query()->whereKey($unitId)->where('product_id', $productId)->where('warehouse_id', $warehouseId)->lockForUpdate()->first();
            $location = $this->locations->resolve($warehouseId, $binId ?? $unit?->bin_id);
            if (! $unit || $unit->status !== 'available' || ($unit->bin_id && (int) $unit->bin_id !== (int) $location->id)) {
                throw ValidationException::withMessages(['inventory_unit_id' => 'The selected unit is not available at this warehouse and location.']);
            }
            $unit->update(['bin_id' => $location->id, 'status' => 'reserved']);

            return;
        }
        $location = $this->locations->resolve($warehouseId, $binId);
        [$total, $stock] = $this->lockBalances($productId, $warehouseId, $location->id);
        if ((float) $stock->quantity - (float) $stock->reserved_quantity < $quantity || (float) $total->quantity - (float) $total->reserved_quantity < $quantity) {
            throw ValidationException::withMessages(['quantity' => 'Insufficient available stock at the selected location.']);
        }
        $stock->increment('reserved_quantity', $quantity);
        $total->increment('reserved_quantity', $quantity);
    }

    public function consume(int $productId, int $warehouseId, float $quantity, string $type, object $reference, ?int $unitId = null, ?int $binId = null): void
    {
        $product = Product::query()->lockForUpdate()->findOrFail($productId);
        if ($product->tracking_type === 'none') return;
        if (in_array($product->tracking_type, ['serial', 'imei'], true)) {
            $unit = InventoryUnit::query()->whereKey($unitId)->where('product_id', $productId)->where('warehouse_id', $warehouseId)->lockForUpdate()->firstOrFail();
            $location = $this->locations->resolve($warehouseId, $binId ?? $unit->bin_id, false);
            if (! in_array($unit->status, ['reserved', 'available'], true) || ($unit->bin_id && (int) $unit->bin_id !== (int) $location->id)) {
                throw ValidationException::withMessages(['inventory_unit_id' => 'The selected unit cannot be consumed at this location.']);
            }
            $unit->update(['bin_id' => $location->id, 'status' => $type === 'repair_use' ? 'repair' : 'sold']);
            $this->movement($productId, $warehouseId, $type, -1, $reference, null, $unit->id, $location->id);

            return;
        }
        $location = $this->locations->resolve($warehouseId, $binId, false);
        [$total, $stock] = $this->lockBalances($productId, $warehouseId, $location->id);
        if ((float) $stock->quantity < $quantity || (float) $total->quantity < $quantity) {
            throw ValidationException::withMessages(['quantity' => 'Insufficient stock at the selected location.']);
        }
        if ((float) $stock->reserved_quantity >= $quantity) {
            if ((float) $total->reserved_quantity < $quantity) throw ValidationException::withMessages(['quantity' => 'Warehouse and location reservations do not agree.']);
            $stock->decrement('reserved_quantity', $quantity);
            $total->decrement('reserved_quantity', $quantity);
        } elseif ((float) $stock->quantity - (float) $stock->reserved_quantity < $quantity) {
            throw ValidationException::withMessages(['quantity' => 'This stock is reserved for another order.']);
        }
        $stock->decrement('quantity', $quantity);
        $total->decrement('quantity', $quantity);
        $this->movement($productId, $warehouseId, $type, -$quantity, $reference, null, null, $location->id);
    }

    public function releaseReservation(int $productId, int $warehouseId, float $quantity, ?int $unitId = null, ?int $binId = null): void
    {
        $product = Product::query()->lockForUpdate()->findOrFail($productId);
        if ($product->tracking_type === 'none') return;

        if (in_array($product->tracking_type, ['serial', 'imei'], true)) {
            $unit = InventoryUnit::query()->whereKey($unitId)->where('product_id', $productId)->where('warehouse_id', $warehouseId)->lockForUpdate()->firstOrFail();
            if ($unit->status !== 'reserved') {
                throw ValidationException::withMessages(['inventory_unit_id' => 'The order reservation can no longer be released safely.']);
            }
            $unit->update(['status' => 'available']);

            return;
        }

        $location = $this->locations->resolve($warehouseId, $binId, false);
        [$total, $stock] = $this->lockBalances($productId, $warehouseId, $location->id);
        if ((float) $stock->reserved_quantity < $quantity || (float) $total->reserved_quantity < $quantity) {
            throw ValidationException::withMessages(['quantity' => 'The order reservation can no longer be released safely.']);
        }
        $stock->decrement('reserved_quantity', $quantity);
        $total->decrement('reserved_quantity', $quantity);
    }

    public function transfer(int $productId, int $fromWarehouseId, int $toWarehouseId, float $quantity, ?int $fromBinId = null, ?int $toBinId = null): void
    {
        DB::transaction(function () use ($productId, $fromWarehouseId, $toWarehouseId, $quantity, $fromBinId, $toBinId): void {
            $product = Product::query()->lockForUpdate()->findOrFail($productId);
            if ($product->tracking_type !== 'quantity' || $quantity <= 0) throw ValidationException::withMessages(['quantity' => 'Choose quantity-tracked stock and a positive transfer quantity.']);
            $source = $this->locations->resolve($fromWarehouseId, $fromBinId);
            $destination = $this->locations->resolve($toWarehouseId, $toBinId);
            if ($source->id === $destination->id) throw ValidationException::withMessages(['to_bin_id' => 'Destination location must differ from source.']);
            [$fromTotal, $from] = $this->lockBalances($productId, $fromWarehouseId, $source->id);
            [$toTotal, $to] = $this->lockBalances($productId, $toWarehouseId, $destination->id);
            if ((float) $from->quantity - (float) $from->reserved_quantity < $quantity || (float) $fromTotal->quantity - (float) $fromTotal->reserved_quantity < $quantity) throw ValidationException::withMessages(['quantity' => 'Insufficient available stock at the source location.']);
            $from->decrement('quantity', $quantity);
            $to->increment('quantity', $quantity);
            if ($fromWarehouseId !== $toWarehouseId) {
                $fromTotal->decrement('quantity', $quantity);
                $toTotal->increment('quantity', $quantity);
            }
            $reference = (object) ['id' => null];
            $this->movement($productId, $fromWarehouseId, 'transfer_out', -$quantity, $reference, null, null, $source->id);
            $this->movement($productId, $toWarehouseId, 'transfer_in', $quantity, $reference, null, null, $destination->id);
        }, 5);
    }

    public function restore(int $productId, int $warehouseId, float $quantity, string $disposition, object $reference, ?int $unitId = null, ?int $binId = null): void
    {
        $product = Product::query()->lockForUpdate()->findOrFail($productId);
        if ($product->tracking_type === 'none') return;
        $location = $this->locations->resolve($warehouseId, $binId);
        if (in_array($product->tracking_type, ['serial', 'imei'], true)) {
            $unit = InventoryUnit::query()->whereKey($unitId)->where('product_id', $productId)->lockForUpdate()->firstOrFail();
            $unit->update(['warehouse_id' => $warehouseId, 'bin_id' => $location->id, 'status' => $disposition]);
        } elseif ($disposition === 'available') {
            [$total, $stock] = $this->lockBalances($productId, $warehouseId, $location->id);
            $stock->increment('quantity', $quantity);
            $total->increment('quantity', $quantity);
        }
        $this->movement($productId, $warehouseId, 'customer_return', $quantity, $reference, "Disposition: {$disposition}", $unitId, $location->id);
    }

    private function lockBalances(int $productId, int $warehouseId, int $binId): array
    {
        InventoryStock::query()->firstOrCreate(['product_id' => $productId, 'warehouse_id' => $warehouseId], ['quantity' => 0, 'reserved_quantity' => 0]);
        $total = InventoryStock::query()->where('product_id', $productId)->where('warehouse_id', $warehouseId)->lockForUpdate()->firstOrFail();
        // Older importers/fixtures may still create a warehouse-only balance.
        if (! InventoryLocationStock::query()->where('product_id', $productId)->where('warehouse_id', $warehouseId)->exists() && ((float) $total->quantity !== 0.0 || (float) $total->reserved_quantity !== 0.0)) {
            $unassigned = $this->locations->unassigned($warehouseId);
            InventoryLocationStock::query()->create(['product_id' => $productId, 'warehouse_id' => $warehouseId, 'bin_id' => $unassigned->id, 'quantity' => $total->quantity, 'reserved_quantity' => $total->reserved_quantity]);
        }
        InventoryLocationStock::query()->firstOrCreate(['product_id' => $productId, 'bin_id' => $binId], ['warehouse_id' => $warehouseId, 'quantity' => 0, 'reserved_quantity' => 0]);
        $stock = InventoryLocationStock::query()->where('product_id', $productId)->where('bin_id', $binId)->lockForUpdate()->firstOrFail();

        return [$total, $stock];
    }

    private function movement(int $productId, int $warehouseId, string $type, float $quantity, object $reference, ?string $notes = null, ?int $unitId = null, ?int $binId = null): void
    {
        StockMovement::query()->create(['product_id' => $productId, 'inventory_unit_id' => $unitId, 'warehouse_id' => $warehouseId, 'bin_id' => $binId, 'movement_type' => $type, 'quantity' => $quantity, 'reference_type' => method_exists($reference, 'getMorphClass') ? $reference->getMorphClass() : null, 'reference_id' => $reference->id ?? null, 'notes' => $notes, 'created_by' => auth()->id(), 'created_at' => now()]);
    }
}
