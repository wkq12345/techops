<?php

namespace Tests\Feature\Operations;

use App\Models\Category;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductCategoryFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->create(['name' => 'Super Admin', 'slug' => 'super-admin']));
        $this->actingAs($user);
    }

    private function product(string $sku, ?int $categoryId, string $status = 'active'): Product
    {
        return Product::query()->create(['sku' => $sku, 'name' => $sku, 'category_id' => $categoryId, 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 10, 'selling_price' => 20, 'status' => $status]);
    }

    public function test_category_filter_includes_descendants_and_excludes_other_categories_and_inactive_products(): void
    {
        $parent = Category::query()->create(['name' => 'Components', 'slug' => 'components']);
        $child = Category::query()->create(['name' => 'CPUs', 'slug' => 'cpus', 'parent_id' => $parent->id]);
        $grandchild = Category::query()->create(['name' => 'AMD', 'slug' => 'amd', 'parent_id' => $child->id]);
        $other = Category::query()->create(['name' => 'Computers', 'slug' => 'computers']);
        $direct = $this->product('DIRECT', $parent->id);
        $nested = $this->product('NESTED', $grandchild->id);
        $this->product('OTHER', $other->id);
        $this->product('UNCATEGORIZED', null);
        $this->product('INACTIVE', $child->id, 'inactive');

        $response = $this->getJson('/api/v1/products?category_id='.$parent->id.'&status=active')->assertOk();
        $this->assertSame([$nested->id, $direct->id], array_column($response->json('data'), 'id'));
        $response = $this->getJson('/api/v1/products?category_id='.$child->id.'&status=active')->assertOk();
        $this->assertSame([$nested->id], array_column($response->json('data'), 'id'));
        $this->getJson('/api/v1/products?status=active')->assertOk()->assertJsonCount(4, 'data');
    }

    public function test_category_filter_works_across_cursor_pages(): void
    {
        $category = Category::query()->create(['name' => 'Parts', 'slug' => 'parts']);
        $first = $this->product('FIRST', $category->id);
        $second = $this->product('SECOND', $category->id);
        $this->product('OTHER', null);
        $filters = ['category_id' => $category->id, 'status' => 'active', 'per_page' => 1];
        $response = $this->getJson('/api/v1/products?'.http_build_query($filters))->assertOk()->assertJsonPath('data.0.id', $second->id);
        $this->assertNotNull($response->json('next_cursor'));
        $this->getJson('/api/v1/products?'.http_build_query([...$filters, 'cursor' => $response->json('next_cursor')]))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id)->assertJsonPath('next_cursor', null);
    }

    public function test_empty_category_and_invalid_filters_have_clear_responses(): void
    {
        $empty = Category::query()->create(['name' => 'Empty', 'slug' => 'empty']);
        $this->product('OTHER', null);
        $this->getJson('/api/v1/products?category_id='.$empty->id)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/products?category_id=99999')->assertUnprocessable()->assertJsonValidationErrors('category_id');
        $this->getJson('/api/v1/products?status=unknown')->assertUnprocessable()->assertJsonValidationErrors('status');
    }
}
