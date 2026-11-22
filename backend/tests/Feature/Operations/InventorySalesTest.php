<?php

namespace Tests\Feature\Operations;

use App\Models\Customer;
use App\Models\InventoryStock;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SalesOrderItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\SalesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InventorySalesTest extends TestCase
{
    use RefreshDatabase;

    public function test_sale_reserves_and_consumes_stock_with_movement_payment_and_invoice(): void
    {
        $this->actingAs(User::factory()->create());
        $warehouse = Warehouse::query()->create(['code' => 'WH-T', 'name' => 'Test']);
        $customer = Customer::query()->create(['customer_code' => 'C-T', 'name' => 'Customer']);
        $product = Product::query()->create(['sku' => 'P-T', 'name' => 'Test Product', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 50, 'selling_price' => 100, 'status' => 'active']);
        InventoryStock::query()->create(['product_id' => $product->id, 'warehouse_id' => $warehouse->id, 'quantity' => 5, 'reserved_quantity' => 0]);

        $service = app(SalesService::class);
        $order = $service->create(['customer_id' => $customer->id, 'warehouse_id' => $warehouse->id, 'items' => [['product_id' => $product->id, 'quantity' => 2]]]);
        $this->assertEquals(2, InventoryStock::query()->value('reserved_quantity'));

        $service->complete($order, ['method' => 'cash']);
        $stock = InventoryStock::query()->firstOrFail();
        $this->assertEquals(3, (float) $stock->quantity);
        $this->assertEquals(0, (float) $stock->reserved_quantity);
        $this->assertDatabaseHas('stock_movements', ['movement_type' => 'sale', 'quantity' => -2]);
        $this->assertDatabaseHas('payments', ['sales_order_id' => $order->id, 'amount' => 200]);
        $this->assertDatabaseHas('invoices', ['sales_order_id' => $order->id, 'status' => 'paid']);
        $this->assertEquals(1, SalesOrderItem::query()->count());
        $this->assertEquals(1, Payment::query()->count());
        $this->assertEquals(1, StockMovement::query()->count());
    }

    public function test_one_order_reserves_and_consumes_each_items_own_location(): void
    {
        $this->actingAs(User::factory()->create());
        $product = Product::query()->create(['sku' => 'LOC-P', 'name' => 'Product', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 50, 'selling_price' => 100, 'status' => 'active']);
        $shop = Warehouse::query()->create(['code' => 'LOC-SHOP', 'name' => 'Shop']);
        $store = Warehouse::query()->create(['code' => 'LOC-STORE', 'name' => 'Storeroom']);
        $shopStock = InventoryStock::query()->create(['product_id' => $product->id, 'warehouse_id' => $shop->id, 'quantity' => 10]);
        $storeStock = InventoryStock::query()->create(['product_id' => $product->id, 'warehouse_id' => $store->id, 'quantity' => 7]);

        $service = app(SalesService::class);
        $order = $service->create(['items' => [
            ['product_id' => $product->id, 'warehouse_id' => $shop->id, 'quantity' => 2],
            ['product_id' => $product->id, 'warehouse_id' => $store->id, 'quantity' => 3],
        ]]);

        $this->assertNull($order->warehouse_id);
        $this->assertEquals(2, $shopStock->fresh()->reserved_quantity);
        $this->assertEquals(3, $storeStock->fresh()->reserved_quantity);
        $this->assertEqualsCanonicalizing([$shop->id, $store->id], $order->items->pluck('warehouse_id')->all());

        $service->complete($order, ['method' => 'cash']);
        $this->assertEquals(8, $shopStock->fresh()->quantity);
        $this->assertEquals(4, $storeStock->fresh()->quantity);
        $this->assertEquals(0, $shopStock->fresh()->reserved_quantity);
        $this->assertEquals(0, $storeStock->fresh()->reserved_quantity);
        $this->assertDatabaseHas('stock_movements', ['warehouse_id' => $shop->id, 'movement_type' => 'sale', 'quantity' => -2]);
        $this->assertDatabaseHas('stock_movements', ['warehouse_id' => $store->id, 'movement_type' => 'sale', 'quantity' => -3]);
        $this->assertDatabaseHas('invoices', ['sales_order_id' => $order->id, 'total' => 500]);
    }

    public function test_combined_line_demand_cannot_overreserve_a_location_and_rolls_back_the_order(): void
    {
        $this->actingAs(User::factory()->create());
        $product = Product::query()->create(['sku' => 'LOC-P', 'name' => 'Product', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 50, 'selling_price' => 100, 'status' => 'active']);
        $location = Warehouse::query()->create(['code' => 'LOC-1', 'name' => 'Shop']);
        $stock = InventoryStock::query()->create(['product_id' => $product->id, 'warehouse_id' => $location->id, 'quantity' => 5]);
        try {
            app(SalesService::class)->create(['items' => [
                ['product_id' => $product->id, 'warehouse_id' => $location->id, 'quantity' => 3],
                ['product_id' => $product->id, 'warehouse_id' => $location->id, 'quantity' => 3],
            ]]);
            $this->fail('Combined demand must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('items.1.quantity', $exception->errors());
        }
        $this->assertDatabaseCount('sales_orders', 0);
        $this->assertDatabaseCount('sales_order_items', 0);
        $this->assertEquals(0, $stock->fresh()->reserved_quantity);
        $this->assertEquals(5, $stock->fresh()->quantity);
    }
}
