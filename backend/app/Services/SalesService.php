<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\InventoryUnit;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SalesOrder;
use App\Models\SalesOrderItem;
use App\Models\Warehouse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesService
{
    public function __construct(private readonly InventoryService $inventory, private readonly AuditService $audit, private readonly InventoryLocationService $bins, private readonly RecordCodeService $codes) {}

    public function create(array $data): SalesOrder
    {
        return DB::transaction(function () use ($data): SalesOrder {
            $inputs = $data['items'];
            $products = Product::query()->whereIn('id', array_column($inputs, 'product_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $locationIds = collect($inputs)->map(fn ($input) => $input['warehouse_id'] ?? $data['warehouse_id'] ?? null)->filter()->unique()->values();
            $locations = Warehouse::query()->whereIn('id', $locationIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            foreach ($inputs as $index => &$input) {
                $product = $products->get($input['product_id']);
                if (! $product || $product->status !== 'active') {
                    throw ValidationException::withMessages(["items.{$index}.product_id" => 'Select an active product.']);
                }
                $input['warehouse_id'] = $input['warehouse_id'] ?? $data['warehouse_id'] ?? null;
                $location = $locations->get($input['warehouse_id']);
                if (($product->tracking_type !== 'none' && ! $location) || ($location && $location->status !== 'active')) {
                    throw ValidationException::withMessages(["items.{$index}.warehouse_id" => 'Select an active warehouse for this item.']);
                }
                $input['bin_id'] = null;
                if ($product->tracking_type !== 'none') {
                    try {
                        $requestedBin = $data['items'][$index]['bin_id'] ?? null;
                        if (! $requestedBin && ! empty($input['inventory_unit_id'])) {
                            $requestedBin = InventoryUnit::query()->whereKey($input['inventory_unit_id'])->where('product_id', $product->id)->where('warehouse_id', $input['warehouse_id'])->value('bin_id');
                        }
                        $input['bin_id'] = $this->bins->resolve((int) $input['warehouse_id'], $requestedBin)->id;
                    } catch (ValidationException $exception) {
                        throw ValidationException::withMessages(["items.{$index}.bin_id" => $exception->errors()['bin_id'] ?? ['Select an active location in this warehouse.']]);
                    }
                }
                if (! in_array($product->tracking_type, ['serial', 'imei'], true) && ! empty($input['inventory_unit_id'])) {
                    throw ValidationException::withMessages(["items.{$index}.inventory_unit_id" => 'Only serialized products can have a serial or IMEI unit.']);
                }
            }
            unset($input);
            $order = SalesOrder::query()->create([
                'number' => $this->number('SO'),
                'customer_id' => $data['customer_id'] ?? null,
                'warehouse_id' => $locationIds->count() === 1 ? $locationIds->first() : null,
                'status' => 'confirmed',
                'notes' => $data['notes'] ?? null,
                'created_by' => auth()->id(),
            ]);
            $subtotal = 0;
            foreach ($inputs as $index => $input) {
                $product = $products->get($input['product_id']);
                $quantity = (float) $input['quantity'];
                $price = (float) $product->selling_price;
                $subtotal += $quantity * $price;
                $item = SalesOrderItem::query()->create(['sales_order_id' => $order->id, 'product_id' => $product->id, 'warehouse_id' => $input['warehouse_id'], 'bin_id' => $input['bin_id'], 'inventory_unit_id' => $input['inventory_unit_id'] ?? null, 'quantity' => $quantity, 'unit_cost' => $product->cost_price, 'unit_price' => $price, 'line_total' => $quantity * $price]);
                if ($product->tracking_type !== 'none') {
                    try {
                        $this->inventory->reserve($product->id, (int) $item->warehouse_id, $quantity, $item->inventory_unit_id, $item->bin_id);
                    } catch (ValidationException $exception) {
                        $errors = [];
                        foreach ($exception->errors() as $key => $messages) $errors["items.{$index}.{$key}"] = $messages;
                        throw ValidationException::withMessages($errors);
                    }
                }
            }
            $tax = round($subtotal * (float) ($data['tax_rate'] ?? 0), 2);
            $order->update(['subtotal' => $subtotal, 'tax' => $tax, 'total' => $subtotal + $tax]);
            $this->audit->record('sales_order.created', $order, null, $order->fresh('items')->toArray());

            return $order->fresh('items');
        });
    }

    public function complete(SalesOrder $order, array $payment): SalesOrder
    {
        return DB::transaction(function () use ($order, $payment): SalesOrder {
            $order = SalesOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if (! in_array($order->status, ['confirmed', 'processing'], true)) {
                throw ValidationException::withMessages(['status' => ['Only confirmed orders can be completed.']]);
            }
            $items = SalesOrderItem::query()->where('sales_order_id', $order->id)->orderBy('warehouse_id')->orderBy('product_id')->orderBy('id')->lockForUpdate()->get();
            foreach ($items as $item) {
                if (Product::query()->findOrFail($item->product_id)->tracking_type === 'none') continue;
                $locationId = $item->warehouse_id ?? $order->warehouse_id;
                if (! $locationId) throw ValidationException::withMessages(['items' => 'An inventory location is missing from an order item.']);
                $this->inventory->consume($item->product_id, (int) $locationId, (float) $item->quantity, 'sale', $order, $item->inventory_unit_id, $item->bin_id);
            }
            Payment::query()->create(['sales_order_id' => $order->id, 'amount' => $order->total, 'method' => $payment['method'], 'reference' => $payment['reference'] ?? null, 'status' => 'completed', 'paid_at' => now(), 'created_by' => auth()->id()]);
            Invoice::query()->create(['number' => $this->number('INV'), 'sales_order_id' => $order->id, 'issued_at' => today(), 'total' => $order->total, 'status' => 'paid']);
            $this->issueWarranties($order, $items);
            $old = $order->toArray();
            $order->update(['status' => 'completed']);
            $this->audit->record('sales_order.completed', $order, $old, $order->fresh()->toArray());

            return $order->fresh();
        });
    }

    public function delete(SalesOrder $order): void
    {
        DB::transaction(function () use ($order): void {
            $order = SalesOrder::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            if (! in_array($order->status, ['draft', 'confirmed', 'processing'], true)
                || Invoice::query()->where('sales_order_id', $order->id)->exists()
                || \App\Models\SalesReturn::query()->where('sales_order_id', $order->id)->exists()) {
                throw ValidationException::withMessages(['sales_order' => 'Only uncompleted orders without invoices or returns can be deleted.']);
            }

            $before = $order->load('items')->toArray();
            if (in_array($order->status, ['confirmed', 'processing'], true)) {
                $items = SalesOrderItem::query()->where('sales_order_id', $order->id)->orderBy('warehouse_id')->orderBy('product_id')->orderBy('id')->lockForUpdate()->get();
                foreach ($items as $item) {
                    $this->inventory->releaseReservation($item->product_id, (int) ($item->warehouse_id ?? $order->warehouse_id), (float) $item->quantity, $item->inventory_unit_id, $item->bin_id);
                }
            }

            $this->audit->record('sales_order.deleted', $order, $before, null);
            $order->delete();
        }, 5);
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('YmdHis').'-'.str()->upper(str()->random(4));
    }

    private function issueWarranties(SalesOrder $order, $items): void
    {
        foreach ($items as $item) {
            $product = Product::query()->findOrFail($item->product_id);
            $months = (int) $product->warranty_months;
            if ($months < 1) continue;

            $units = $item->inventory_unit_id
                ? InventoryUnit::query()->whereKey($item->inventory_unit_id)->get()
                : collect([null]);
            foreach ($units as $unit) {
                $exists = \App\Models\Warranty::query()->where('reference_type', $order->getMorphClass())
                    ->where('reference_id', $order->id)->where('product_id', $product->id)
                    ->where('inventory_unit_id', $unit?->id)->exists();
                if ($exists) continue;
                $start = today();
                $end = $start->copy()->addMonthsNoOverflow($months);
                \App\Models\Warranty::query()->create([
                    'number' => $this->codes->next('warranties'), 'customer_id' => $order->customer_id,
                    'reference_type' => $order->getMorphClass(), 'reference_id' => $order->id,
                    'product_id' => $product->id, 'inventory_unit_id' => $unit?->id,
                    'warranty_start' => $start->toDateString(), 'warranty_end' => $end->toDateString(),
                    'warranty_type' => 'standard', 'status' => 'active',
                ]);
                if ($unit) $unit->update(['warranty_start' => $start->toDateString(), 'warranty_end' => $end->toDateString()]);
            }
        }
    }
}
