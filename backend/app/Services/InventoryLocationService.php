<?php

namespace App\Services;

use App\Models\Warehouse;
use App\Models\WarehouseBin;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryLocationService
{
    public function __construct(private readonly RecordCodeService $codes) {}

    public function unassigned(int $warehouseId): WarehouseBin
    {
        return DB::transaction(function () use ($warehouseId): WarehouseBin {
            Warehouse::query()->whereKey($warehouseId)->lockForUpdate()->firstOrFail();
            return WarehouseBin::query()->where('warehouse_id', $warehouseId)->where('is_unassigned', true)->first()
                ?? WarehouseBin::query()->create(['warehouse_id' => $warehouseId, 'code' => $this->codes->next('warehouse-bins'), 'name' => 'Unassigned', 'is_unassigned' => true, 'status' => 'active']);
        }, 5);
    }

    public function resolve(int $warehouseId, ?int $binId = null, bool $requireActive = true): WarehouseBin
    {
        $warehouse = Warehouse::query()->whereKey($warehouseId)->lockForUpdate()->firstOrFail();
        $location = $binId ? WarehouseBin::query()->whereKey($binId)->where('warehouse_id', $warehouseId)->lockForUpdate()->first() : $this->unassigned($warehouseId);
        if (! $location || ($requireActive && ($location->status !== 'active' || $warehouse->status !== 'active'))) {
            throw ValidationException::withMessages(['bin_id' => 'Choose an active location within the selected warehouse.']);
        }

        return $location;
    }
}
