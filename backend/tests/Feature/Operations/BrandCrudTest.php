<?php

namespace Tests\Feature\Operations;

use App\Models\Brand;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BrandCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->create(['name' => 'Super Admin', 'slug' => 'super-admin']));
        $this->actingAs($user);
    }

    private function brand(string $name): Brand
    {
        $response = $this->postJson('/api/v1/brands', ['name' => $name, 'status' => 'active'])->assertCreated();

        return Brand::query()->findOrFail($response->json('data.id'));
    }

    public function test_create_and_edit_generate_and_preserve_identifier(): void
    {
        $brand = $this->brand('AMD');
        $this->assertNotEmpty($brand->slug);
        $this->putJson('/api/v1/brands/'.$brand->id, ['name' => 'Advanced Micro Devices', 'status' => 'inactive'])
            ->assertOk()->assertJsonPath('data.name', 'Advanced Micro Devices')->assertJsonPath('data.status', 'inactive')->assertJsonPath('data.slug', $brand->slug);
        $this->assertDatabaseHas('audit_logs', ['action' => 'brands.created', 'entity_id' => $brand->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'brands.updated', 'entity_id' => $brand->id]);
    }

    public function test_duplicate_names_manual_identifiers_and_invalid_status_are_rejected(): void
    {
        $brand = $this->brand('AMD');
        $this->postJson('/api/v1/brands', ['name' => 'AMD'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/api/v1/brands', ['name' => 'Intel', 'slug' => 'manual'])->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->putJson('/api/v1/brands/'.$brand->id, ['name' => 'AMD', 'slug' => 'manual'])->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->putJson('/api/v1/brands/'.$brand->id, ['name' => 'AMD', 'status' => 'invalid'])->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_deletion_protects_linked_products_and_only_audits_success(): void
    {
        $brand = $this->brand('AMD');
        $product = Product::query()->create(['sku' => 'CPU', 'name' => 'CPU', 'brand_id' => $brand->id, 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 10, 'selling_price' => 20]);
        $this->deleteJson('/api/v1/brands/'.$brand->id)->assertUnprocessable()->assertJsonValidationErrors('brand');
        $this->assertSame($brand->id, $product->fresh()->brand_id);
        $this->assertDatabaseHas('brands', ['id' => $brand->id]);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'brands.deleted', 'entity_id' => $brand->id]);
        $unused = $this->brand('Unused');
        $this->deleteJson('/api/v1/brands/'.$unused->id)->assertOk();
        $this->assertDatabaseMissing('brands', ['id' => $unused->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'brands.deleted', 'entity_id' => $unused->id]);
    }

    public function test_list_search_cursor_pagination_and_product_counts(): void
    {
        $first = $this->brand('AMD');
        $second = $this->brand('Intel');
        Product::query()->create(['sku' => 'CPU', 'name' => 'CPU', 'brand_id' => $first->id, 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 10, 'selling_price' => 20]);
        $response = $this->getJson('/api/v1/brands?per_page=1')->assertOk()->assertJsonPath('data.0.id', $second->id)->assertJsonPath('data.0.products_count', 0);
        $this->getJson('/api/v1/brands?per_page=1&cursor='.urlencode($response->json('next_cursor')))
            ->assertOk()->assertJsonPath('data.0.id', $first->id)->assertJsonPath('data.0.products_count', 1)->assertJsonPath('next_cursor', null);
        $this->getJson('/api/v1/brands?search=AMD')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id);
    }

    public function test_catalog_permissions_are_required(): void
    {
        $brand = $this->brand('AMD');
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/brands')->assertForbidden();
        $this->postJson('/api/v1/brands', ['name' => 'Intel'])->assertForbidden();
        $this->putJson('/api/v1/brands/'.$brand->id, ['name' => 'Denied'])->assertForbidden();
        $this->deleteJson('/api/v1/brands/'.$brand->id)->assertForbidden();
    }
}
