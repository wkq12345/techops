<?php

namespace Tests\Feature\Operations;

use App\Models\Customer;
use App\Models\InventoryStock;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\InventoryService;
use App\Services\RepairService;
use App\Services\ReturnService;
use App\Services\SalesService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class WorkflowActionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_repair_can_be_opened_and_advanced_with_history(): void
    {
        $this->actingAs(User::factory()->create());
        $customer = Customer::query()->create(['customer_code' => 'C-R', 'name' => 'Repair customer']);

        $repair = app(RepairService::class)->create([
            'customer_id' => $customer->id,
            'device' => ['device_type' => 'laptop', 'reported_problem' => 'Does not power on'],
        ]);
        app(RepairService::class)->transition($repair, 'diagnosing', 'Intake complete');

        $this->assertDatabaseHas('repair_status_history', ['repair_job_id' => $repair->id, 'to_status' => 'diagnosing']);
        $this->assertDatabaseHas('repair_jobs', ['id' => $repair->id, 'status' => 'diagnosing']);
    }

    public function test_sales_order_detail_includes_lines(): void
    {
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->create(['name' => 'Super Admin', 'slug' => 'super-admin']));
        $this->actingAs($user);
        $warehouse = Warehouse::query()->create(['code' => 'WH-D', 'name' => 'Detail']);
        $product = Product::query()->create(['sku' => 'P-D', 'name' => 'Detail product', 'product_type' => 'service', 'tracking_type' => 'none', 'cost_price' => 0, 'selling_price' => 25, 'status' => 'active']);
        $order = app(SalesService::class)->create(['warehouse_id' => $warehouse->id, 'items' => [['product_id' => $product->id, 'quantity' => 1]]]);

        $this->getJson("/api/v1/sales-orders/{$order->id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.product_id', $product->id);
    }

    public function test_return_cannot_exceed_remaining_sold_quantity(): void
    {
        $this->actingAs(User::factory()->create());
        $warehouse = Warehouse::query()->create(['code' => 'WH-R', 'name' => 'Returns']);
        $product = Product::query()->create(['sku' => 'P-R', 'name' => 'Return product', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 10, 'selling_price' => 20, 'status' => 'active']);
        InventoryStock::query()->create(['product_id' => $product->id, 'warehouse_id' => $warehouse->id, 'quantity' => 5, 'reserved_quantity' => 0]);
        $order = app(SalesService::class)->create(['warehouse_id' => $warehouse->id, 'items' => [['product_id' => $product->id, 'quantity' => 2]]]);
        app(SalesService::class)->complete($order, ['method' => 'cash']);
        $lineId = $order->items()->firstOrFail()->id;
        app(ReturnService::class)->create(['sales_order_id' => $order->id, 'warehouse_id' => $warehouse->id, 'items' => [['sales_order_item_id' => $lineId, 'quantity' => 1, 'reason' => 'defective', 'disposition' => 'available', 'refund_amount' => 20]]]);

        $this->expectException(ValidationException::class);
        app(ReturnService::class)->create(['sales_order_id' => $order->id, 'warehouse_id' => $warehouse->id, 'items' => [['sales_order_item_id' => $lineId, 'quantity' => 2, 'reason' => 'defective', 'disposition' => 'available', 'refund_amount' => 40]]]);
    }

    public function test_serialized_sale_requires_exactly_one_unit_per_line(): void
    {
        $product = Product::query()->create(['sku' => 'SER-T', 'name' => 'Serialized', 'product_type' => 'serialized', 'tracking_type' => 'serial', 'cost_price' => 10, 'selling_price' => 20, 'status' => 'active']);
        $warehouse = Warehouse::query()->create(['code' => 'WH-S', 'name' => 'Serial']);

        $this->expectException(ValidationException::class);
        app(InventoryService::class)->reserve($product->id, $warehouse->id, 2);
    }
}
