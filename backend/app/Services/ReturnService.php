<?php

namespace App\Services;

use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReturnService
{
    public function __construct(private readonly InventoryService $inventory, private readonly AuditService $audit, private readonly InventoryLocationService $locations) {}

    public function create(array $data): SalesReturn
    {
        return DB::transaction(function () use ($data) {
            $order = SalesOrder::query()->whereKey($data['sales_order_id'])->lockForUpdate()->firstOrFail();
            if ($order->status !== 'completed') {
                throw ValidationException::withMessages(['sales_order_id' => ['Only completed sales can be returned.']]);
            }$return = SalesReturn::query()->create(['number' => 'RET-'.now()->format('YmdHis').'-'.str()->upper(str()->random(4)), 'sales_order_id' => $order->id, 'status' => 'completed', 'notes' => $data['notes'] ?? null, 'created_by' => auth()->id()]);
            foreach ($data['items'] as $input) {
                $line = SalesOrderItem::query()->where('sales_order_id', $order->id)->whereKey($input['sales_order_item_id'])->lockForUpdate()->firstOrFail();
                $alreadyReturned = (float) SalesReturnItem::query()->where('sales_order_item_id', $line->id)->sum('quantity');
                if ($alreadyReturned + (float) $input['quantity'] > (float) $line->quantity) {
                    throw ValidationException::withMessages(['items' => ['Return quantity exceeds the remaining sold quantity.']]);
                }
                $bin = $this->locations->resolve($data['warehouse_id'], $data['bin_id'] ?? null);
                $item = SalesReturnItem::query()->create(['sales_return_id' => $return->id, 'sales_order_item_id' => $line->id, 'product_id' => $line->product_id, 'bin_id' => $bin->id, 'inventory_unit_id' => $line->inventory_unit_id, 'quantity' => $input['quantity'], 'reason' => $input['reason'], 'disposition' => $input['disposition'], 'refund_amount' => $input['refund_amount']]);
                $this->inventory->restore($line->product_id, $data['warehouse_id'], $input['quantity'], $input['disposition'], $return, $line->inventory_unit_id, $bin->id);
            } $this->audit->record('sales_return.completed', $return, null, $return->toArray());

            return $return;
        });
    }
}
