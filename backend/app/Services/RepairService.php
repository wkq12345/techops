<?php

namespace App\Services;

use App\Models\Product;
use App\Models\RepairDevice;
use App\Models\RepairJob;
use App\Models\RepairPart;
use App\Models\RepairStatusHistory;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RepairService
{
    private const TRANSITIONS = ['received' => ['diagnosing', 'cancelled'], 'diagnosing' => ['awaiting_approval', 'cancelled'], 'awaiting_approval' => ['awaiting_parts', 'repairing', 'cancelled'], 'awaiting_parts' => ['repairing', 'cancelled'], 'repairing' => ['testing', 'cancelled'], 'testing' => ['ready_for_collection', 'repairing'], 'ready_for_collection' => ['completed'], 'completed' => [], 'cancelled' => []];

    public function __construct(private readonly InventoryService $inventory, private readonly AuditService $audit, private readonly InventoryLocationService $locations) {}

    public function create(array $data): RepairJob
    {
        return DB::transaction(function () use ($data) {
            $job = RepairJob::query()->create(['number' => 'REP-'.now()->format('YmdHis').'-'.str()->upper(str()->random(4)), 'customer_id' => $data['customer_id'], 'technician_id' => $data['technician_id'] ?? null, 'status' => 'received', 'estimated_cost' => $data['estimated_cost'] ?? null, 'created_by' => auth()->id()]);
            RepairDevice::query()->create(['repair_job_id' => $job->id, ...$data['device']]);
            RepairStatusHistory::query()->create(['repair_job_id' => $job->id, 'to_status' => 'received', 'changed_by' => auth()->id(), 'created_at' => now()]);
            $this->audit->record('repair.created', $job, null, $job->toArray());

            return $job;
        });
    }

    public function transition(RepairJob $job, string $status, ?string $notes = null): RepairJob
    {
        return DB::transaction(function () use ($job, $status, $notes) {
            $job = RepairJob::query()->whereKey($job->id)->lockForUpdate()->firstOrFail();
            if (! in_array($status, self::TRANSITIONS[$job->status] ?? [], true)) {
                throw ValidationException::withMessages(['status' => ["Cannot move repair from {$job->status} to {$status}."]]);
            }$old = $job->status;
            $job->update(['status' => $status, 'completed_at' => $status === 'completed' ? now() : null]);
            RepairStatusHistory::query()->create(['repair_job_id' => $job->id, 'from_status' => $old, 'to_status' => $status, 'notes' => $notes, 'changed_by' => auth()->id(), 'created_at' => now()]);
            $this->audit->record('repair.status_changed', $job, ['status' => $old], ['status' => $status]);
            if ($status === 'ready_for_collection') {
                app(NotificationService::class)->users([$job->created_by, $job->technician_id], 'Repair ready for collection', "Repair {$job->number} is ready for collection.", 'repair_ready', '/modules/repairs');
            }

            return $job;
        });
    }

    public function addPart(RepairJob $job, array $data): RepairPart
    {
        return DB::transaction(function () use ($job, $data) {
            $product = Product::query()->findOrFail($data['product_id']);
            $unitBin = ! empty($data['inventory_unit_id']) ? \App\Models\InventoryUnit::query()->whereKey($data['inventory_unit_id'])->where('warehouse_id', $data['warehouse_id'])->value('bin_id') : null;
            $bin = $this->locations->resolve($data['warehouse_id'], $data['bin_id'] ?? $unitBin);
            $part = RepairPart::query()->create(['repair_job_id' => $job->id, 'product_id' => $product->id, 'bin_id' => $bin->id, 'inventory_unit_id' => $data['inventory_unit_id'] ?? null, 'quantity' => $data['quantity'], 'cost_price' => $product->cost_price, 'selling_price' => $product->selling_price, 'status' => 'used']);
            $this->inventory->reserve($product->id, $data['warehouse_id'], $data['quantity'], $part->inventory_unit_id, $bin->id);
            $this->inventory->consume($product->id, $data['warehouse_id'], $data['quantity'], 'repair_use', $job, $part->inventory_unit_id, $bin->id);

            return $part;
        });
    }
}
