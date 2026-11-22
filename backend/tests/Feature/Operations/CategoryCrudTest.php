<?php

namespace Tests\Feature\Operations;

use App\Models\Category;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $user = User::factory()->create();
        $user->roles()->attach(Role::query()->create(['name' => 'Super Admin', 'slug' => 'super-admin']));
        $this->actingAs($user);
    }

    private function category(string $name, ?int $parent = null): Category
    {
        $response = $this->postJson('/api/v1/categories', ['name' => $name, 'parent_id' => $parent, 'status' => 'active'])->assertCreated();

        return Category::query()->findOrFail($response->json('data.id'));
    }

    public function test_create_rename_reparent_and_unique_automatic_identifiers(): void
    {
        $first = $this->category('Components');
        $second = $this->category('Components');
        $this->assertNotSame($first->slug, $second->slug);
        $this->putJson('/api/v1/categories/'.$second->id, ['name' => 'CPUs', 'parent_id' => $first->id, 'status' => 'inactive'])
            ->assertOk()->assertJsonPath('data.slug', $second->slug)->assertJsonPath('data.status', 'inactive');
        $this->putJson('/api/v1/categories/'.$second->id, ['name' => 'CPUs', 'parent_id' => null])->assertOk()->assertJsonPath('data.parent_id', null);
        $this->postJson('/api/v1/categories', ['name' => 'Manual', 'slug' => 'manual'])->assertUnprocessable()->assertJsonValidationErrors('slug');
    }

    public function test_self_parent_and_descendant_cycles_are_rejected_without_changes(): void
    {
        $root = $this->category('Components');
        $child = $this->category('CPUs', $root->id);
        $leaf = $this->category('AMD', $child->id);
        foreach ([$root->id, $child->id, $leaf->id] as $parent) {
            $this->putJson('/api/v1/categories/'.$root->id, ['name' => 'Components', 'parent_id' => $parent])->assertUnprocessable()->assertJsonValidationErrors('parent_id');
        }
        $this->assertNull($root->fresh()->parent_id);
        $this->assertDatabaseMissing('audit_logs', ['action' => 'categories.updated', 'entity_id' => $root->id]);
    }

    public function test_delete_preserves_products_children_and_audit_integrity(): void
    {
        $root = $this->category('Components');
        $child = $this->category('CPUs', $root->id);
        $product = Product::query()->create(['sku' => 'CPU', 'name' => 'CPU', 'category_id' => $child->id, 'product_type' => 'physical', 'tracking_type' => 'quantity', 'cost_price' => 10, 'selling_price' => 20]);
        foreach ([$root, $child] as $category) {
            $this->deleteJson('/api/v1/categories/'.$category->id)->assertUnprocessable()->assertJsonValidationErrors('category');
            $this->assertDatabaseHas('categories', ['id' => $category->id]);
            $this->assertDatabaseMissing('audit_logs', ['action' => 'categories.deleted', 'entity_id' => $category->id]);
        }
        $this->assertSame($child->id, $product->fresh()->category_id);
        $this->assertSame($root->id, $child->fresh()->parent_id);
        $empty = $this->category('Empty');
        $this->deleteJson('/api/v1/categories/'.$empty->id)->assertOk();
        $this->assertDatabaseMissing('categories', ['id' => $empty->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'categories.deleted', 'entity_id' => $empty->id]);
    }

    public function test_list_exposes_parent_and_usage_counts_with_search_and_cursor_pages(): void
    {
        $root = $this->category('Components');
        $child = $this->category('CPUs', $root->id);
        $response = $this->getJson('/api/v1/categories?per_page=1')->assertOk()->assertJsonPath('data.0.parent.name', 'Components')->assertJsonPath('data.0.products_count', 0);
        $this->getJson('/api/v1/categories?per_page=1&cursor='.urlencode($response->json('next_cursor')))
            ->assertOk()->assertJsonPath('data.0.id', $root->id)->assertJsonPath('data.0.children_count', 1)->assertJsonPath('next_cursor', null);
        $this->getJson('/api/v1/categories?search=CPU')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $child->id);
    }

    public function test_category_mutations_require_catalog_permissions(): void
    {
        $category = $this->category('Existing');
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/v1/categories')->assertForbidden();
        $this->postJson('/api/v1/categories', ['name' => 'Denied'])->assertForbidden();
        $this->putJson('/api/v1/categories/'.$category->id, ['name' => 'Denied'])->assertForbidden();
        $this->deleteJson('/api/v1/categories/'.$category->id)->assertForbidden();
    }
}
