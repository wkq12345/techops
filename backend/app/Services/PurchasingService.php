<?php

namespace App\Services;

use App\Models\GoodsReceipt;
use App\Models\GoodsReceiptItem;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchasingService
{
    public function __construct(private readonly InventoryService $inventory, private readonly AuditService $audit, private readonly InventoryLocationService $locations) {}

    public function create(array $data): PurchaseOrder
    {
        return DB::transaction(function () use ($data): PurchaseOrder {
            $order = PurchaseOrder::query()->create(['number' => $this->number('PO'), 'supplier_id' => $data['supplier_id'], 'warehouse_id' => $data['warehouse_id'], 'status' => 'pending_approval', 'expected_at' => $data['expected_at'] ?? null, 'notes' => $data['notes'] ?? null, 'created_by' => auth()->id()]);
            $total = 0;
            foreach ($data['items'] as $input) {
                $product = Product::query()->findOrFail($input['product_id']);
                $qty = (float) $input['quantity'];
                $cost = (float) $input['unit_cost'];
                $total += $qty * $cost;
                PurchaseOrderItem::query()->create(['purchase_order_id' => $order->id, 'product_id' => $product->id, 'ordered_quantity' => $qty, 'unit_cost' => $cost, 'line_total' => $qty * $cost]);
            }
            $order->update(['total' => $total]);
            $this->audit->record('purchase_order.created', $order, null, $order->fresh()->toArray());

            return $order->fresh();
        });
    }

    public function approve(PurchaseOrder $order): PurchaseOrder
    {
        if ($order->status !== 'pending_approval') {
            throw ValidationException::withMessages(['status' => ['Only pending orders can be approved.']]);
        }
        $old = $order->toArray();
        $order->update(['status' => 'approved', 'approved_by' => auth()->id()]);
        $this->audit->record('purchase_order.approved', $order, $old, $order->fresh()->toArray());

        return $order;
    }

    public function receive(PurchaseOrder $order, array $data): GoodsReceipt
    {
        return DB::transaction(function () use ($order, $data): GoodsReceipt {
            $order = PurchaseOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if (! in_array($order->status, ['approved', 'ordered', 'partially_received'], true)) {
                throw ValidationException::withMessages(['status' => ['This purchase order cannot be received.']]);
            }
            $receipt = GoodsReceipt::query()->create(['number' => $this->number('GRN'), 'purchase_order_id' => $order->id, 'warehouse_id' => $order->warehouse_id, 'received_at' => now(), 'notes' => $data['notes'] ?? null, 'received_by' => auth()->id()]);
            foreach ($data['items'] as $input) {
                $line = PurchaseOrderItem::query()->where('purchase_order_id', $order->id)->whereKey($input['purchase_order_item_id'])->lockForUpdate()->firstOrFail();
                $qty = (float) $input['quantity'];
                if ((float) $line->received_quantity + $qty > (float) $line->ordered_quantity) {
                    throw ValidationException::withMessages(['items' => ['Received quantity exceeds the purchase order.']]);
                }
                $bin = $this->locations->resolve($order->warehouse_id, $input['bin_id'] ?? null);
                $item = GoodsReceiptItem::query()->create(['goods_receipt_id' => $receipt->id, 'purchase_order_item_id' => $line->id, 'product_id' => $line->product_id, 'bin_id' => $bin->id, 'quantity' => $qty, 'unit_cost' => $line->unit_cost, 'serials' => $input['serials'] ?? null]);
                $this->inventory->receive($line->product_id, $order->warehouse_id, $qty, (float) $line->unit_cost, $receipt, $input['serials'] ?? [], $bin->id);
                $line->increment('received_quantity', $qty);
            }
            $remaining = PurchaseOrderItem::query()->where('purchase_order_id', $order->id)->whereColumn('received_quantity', '<', 'ordered_quantity')->exists();
            $order->update(['status' => $remaining ? 'partially_received' : 'received']);
            $this->audit->record('goods_receipt.created', $receipt, null, $receipt->toArray());

            return $receipt;
        });
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('YmdHis').'-'.str()->upper(str()->random(4));
    }
}
