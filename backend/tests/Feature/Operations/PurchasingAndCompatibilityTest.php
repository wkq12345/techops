<?php

namespace Tests\Feature\Operations;

use App\Models\Attribute;
use App\Models\InventoryStock;
use App\Models\PcBuild;
use App\Models\PcBuildItem;
use App\Models\Product;
use App\Models\ProductAttributeValue;
use App\Models\PurchaseOrderItem;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\CompatibilityService;
use App\Services\PurchasingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchasingAndCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_goods_receipt_increases_stock_and_closes_order(): void
    {
        $this->actingAs(User::factory()->create());
        $warehouse = Warehouse::query()->create(['code' => 'WH-P', 'name' => 'Purchasing']);
        $supplier = Supplier::query()->create(['supplier_code' => 'SUP-T', 'company_name' => 'Supplier']);
        $product = Product::query()->create(['sku' => 'BUY-T', 'name' => 'Purchased', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 10, 'selling_price' => 20, 'status' => 'active']);
        $service = app(PurchasingService::class);
        $order = $service->create(['supplier_id' => $supplier->id, 'warehouse_id' => $warehouse->id, 'items' => [['product_id' => $product->id, 'quantity' => 4, 'unit_cost' => 10]]]);
        $service->approve($order);
        $line = PurchaseOrderItem::query()->firstOrFail();
        $service->receive($order->fresh(), ['items' => [['purchase_order_item_id' => $line->id, 'quantity' => 4]]]);
        $this->assertEquals(4, (float) InventoryStock::query()->value('quantity'));
        $this->assertDatabaseHas('purchase_orders', ['id' => $order->id, 'status' => 'received']);
        $this->assertDatabaseHas('stock_movements', ['movement_type' => 'purchase_receive', 'quantity' => 4]);
    }

    public function test_cpu_socket_mismatch_is_incompatible(): void
    {
        $socket = Attribute::query()->create(['name' => 'Socket', 'slug' => 'socket', 'data_type' => 'text']);
        $cpu = Product::query()->create(['sku' => 'CPU', 'name' => 'CPU', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 1, 'selling_price' => 1]);
        $board = Product::query()->create(['sku' => 'BOARD', 'name' => 'Board', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 1, 'selling_price' => 1]);
        ProductAttributeValue::query()->create(['product_id' => $cpu->id, 'attribute_id' => $socket->id, 'value' => 'AM5']);
        ProductAttributeValue::query()->create(['product_id' => $board->id, 'attribute_id' => $socket->id, 'value' => 'AM4']);
        $build = PcBuild::query()->create(['number' => 'PCB-T']);
        PcBuildItem::query()->create(['pc_build_id' => $build->id, 'product_id' => $cpu->id, 'component_type' => 'cpu', 'quantity' => 1, 'unit_price' => 1]);
        PcBuildItem::query()->create(['pc_build_id' => $build->id, 'product_id' => $board->id, 'component_type' => 'motherboard', 'quantity' => 1, 'unit_price' => 1]);
        $result = app(CompatibilityService::class)->validate($build);
        $this->assertSame('incompatible', $result['status']);
        $this->assertSame('cpu_socket', $result['results'][0]['rule']);
    }
}
