<?php

namespace Tests\Feature\Operations;

use App\Models\Customer;
use App\Models\Role;
use App\Models\User;
use App\Models\Warehouse;
use App\Services\DomainResourceService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GeneratedRecordCodesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->create(['name' => 'Super Admin', 'slug' => 'super-admin']));
        $this->actingAs($user);
    }

    public static function resources(): array
    {
        return [
            'customers' => ['customers', 'customer_code', 'CUS', ['name' => 'Customer'], 'name'],
            'suppliers' => ['suppliers', 'supplier_code', 'SUP', ['company_name' => 'Supplier'], 'company_name'],
            'products' => ['products', 'sku', 'PRD', ['name' => 'Product', 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 10, 'selling_price' => 20], 'name'],
            'warehouses' => ['warehouses', 'code', 'WH', ['name' => 'Warehouse'], 'name'],
            'bins' => ['warehouse-bins', 'code', 'BIN', ['zone' => 'Zone'], 'zone'],
            'warranties' => ['warranties', 'number', 'WAR', ['warranty_start' => '2026-10-07', 'warranty_end' => '2027-10-07', 'warranty_type' => 'standard'], 'warranty_type'],
            'claims' => ['warranty-claims', 'number', 'WCL', ['issue' => 'Issue'], 'issue'],
        ];
    }

    #[DataProvider('resources')]
    public function test_codes_are_generated_sequentially_and_cannot_be_supplied_or_changed(string $resource, string $field, string $prefix, array $payload, string $editable): void
    {
        if ($resource === 'warehouse-bins') {
            $payload['warehouse_id'] = Warehouse::query()->create(['code' => 'LEGACY-WH', 'name' => 'Warehouse'])->id;
        }
        if ($resource === 'warranty-claims') {
            $payload['warranty_id'] = app(DomainResourceService::class)->create('warranties', ['warranty_start' => '2026-10-07', 'warranty_end' => '2027-10-07', 'warranty_type' => 'standard'])->id;
        }

        $this->postJson("/api/v1/{$resource}", [...$payload, $field => 'MANUAL'])
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertDatabaseMissing('record_code_sequences', ['resource' => $resource]);

        $first = $this->postJson("/api/v1/{$resource}", $payload)
            ->assertCreated()->assertJsonPath("data.{$field}", "{$prefix}-000001");
        $id = $first->json('data.id');

        $this->putJson("/api/v1/{$resource}/{$id}", [...$payload, $field => 'REPLACED'])
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson("/api/v1/{$resource}/{$id}", [...$payload, $editable => 'Updated'])
            ->assertOk()->assertJsonPath("data.{$field}", "{$prefix}-000001")
            ->assertJsonPath("data.{$editable}", 'Updated');

        $this->postJson("/api/v1/{$resource}", $payload)
            ->assertCreated()->assertJsonPath("data.{$field}", "{$prefix}-000002");
        $this->assertDatabaseHas('record_code_sequences', ['resource' => $resource, 'last_value' => 2]);
    }

    public function test_existing_codes_are_preserved_and_the_sequence_starts_after_the_largest_matching_code(): void
    {
        $legacy = Customer::query()->create(['customer_code' => 'OLD-CUSTOMER', 'name' => 'Legacy']);
        $existing = Customer::query()->create(['customer_code' => 'CUS-000041', 'name' => 'Existing']);

        $created = app(DomainResourceService::class)->create('customers', ['name' => 'New']);
        $this->assertSame('CUS-000042', $created->customer_code);
        $this->assertSame('OLD-CUSTOMER', $legacy->fresh()->customer_code);
        $this->assertSame('CUS-000041', $existing->fresh()->customer_code);

        app(DomainResourceService::class)->update('customers', $created->id, ['name' => 'Updated', 'customer_code' => 'TAMPERED']);
        $this->assertSame('CUS-000042', $created->fresh()->customer_code);
        $this->assertSame('Updated', $created->fresh()->name);
    }

    public function test_deleted_codes_are_not_reused_and_later_imported_codes_are_skipped(): void
    {
        $resources = app(DomainResourceService::class);
        $first = $resources->create('customers', ['name' => 'First']);
        $first->delete();
        Customer::query()->create(['customer_code' => 'CUS-000002', 'name' => 'Imported']);
        $next = $resources->create('customers', ['name' => 'Next']);

        $this->assertSame('CUS-000003', $next->customer_code);
        $this->assertDatabaseHas('record_code_sequences', ['resource' => 'customers', 'last_value' => 3]);
    }

    public function test_failed_record_creation_rolls_back_the_code_allocation(): void
    {
        try {
            app(DomainResourceService::class)->create('customers', []);
            $this->fail('Expected the required name constraint to fail.');
        } catch (QueryException) {
            $this->assertDatabaseCount('customers', 0);
            $this->assertDatabaseMissing('record_code_sequences', ['resource' => 'customers']);
        }

        $created = app(DomainResourceService::class)->create('customers', ['name' => 'Valid']);
        $this->assertSame('CUS-000001', $created->customer_code);
    }

    public function test_unauthorized_creation_does_not_allocate_a_code(): void
    {
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/v1/customers', ['name' => 'Not allowed'])->assertForbidden();
        $this->assertSame(0, DB::table('record_code_sequences')->count());
    }
}
