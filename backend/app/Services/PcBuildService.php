<?php

namespace App\Services;

use App\Models\PcBuild;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PcBuildService
{
    public function __construct(private readonly AuditService $audit, private readonly SalesService $sales, private readonly CompatibilityService $compatibility) {}

    public function accept(PcBuild $build): PcBuild
    {
        return DB::transaction(function () use ($build): PcBuild {
            $build = PcBuild::query()->whereKey($build->id)->lockForUpdate()->firstOrFail();
            if ($build->status !== 'draft' || $build->sales_order_id) {
                throw ValidationException::withMessages(['build' => 'Only an unconverted draft build can be accepted.']);
            }
            if (! $build->items()->exists()) {
                throw ValidationException::withMessages(['build' => 'Add at least one component before accepting the build.']);
            }
            $compatibility = $this->compatibility->validate($build);
            if ($compatibility['status'] === 'incompatible') {
                throw ValidationException::withMessages(['compatibility' => 'Resolve incompatible components before accepting this build.']);
            }
            $old = $build->toArray();
            $build->update(['status' => 'accepted']);
            $this->audit->record('pc-builds.accepted', $build, $old, $build->fresh()->toArray());
            return $build->fresh(['items', 'requirement']);
        }, 5);
    }

    public function duplicate(PcBuild $source): PcBuild
    {
        $source->load(['items', 'requirement']);
        if ($source->items->isEmpty()) {
            throw ValidationException::withMessages(['build' => 'Add at least one component before saving a build as a template.']);
        }
        return $this->save([
            'customer_id' => $source->customer_id, 'budget' => $source->budget, 'notes' => $source->notes,
            'requirements' => $source->requirement?->requirements ?? [],
            'items' => $source->items->map(fn ($item) => ['product_id' => $item->product_id, 'component_type' => $item->component_type, 'quantity' => $item->quantity])->all(),
        ]);
    }

    public function convertToSalesOrder(PcBuild $build, array $locations): \App\Models\SalesOrder
    {
        return DB::transaction(function () use ($build, $locations): \App\Models\SalesOrder {
            $build = PcBuild::query()->whereKey($build->id)->lockForUpdate()->firstOrFail();
            if ($build->sales_order_id || $build->status !== 'accepted') {
                throw ValidationException::withMessages(['build' => 'Accept this build before turning it into a sales order.']);
            }
            $items = $build->items()->orderBy('id')->lockForUpdate()->get();
            if ($items->isEmpty() || count($locations) !== $items->count()) {
                throw ValidationException::withMessages(['items' => 'Provide a stock location for every build component.']);
            }
            $inputs = collect($locations)->keyBy('pc_build_item_id');
            $orderItems = $items->map(function ($item) use ($inputs): array {
                $location = $inputs->get($item->id);
                if (! $location || (int) $location['product_id'] !== (int) $item->product_id) {
                    throw ValidationException::withMessages(['items' => 'The selected items do not match this build.']);
                }
                return ['product_id' => $item->product_id, 'warehouse_id' => (int) $location['warehouse_id'], 'bin_id' => (int) $location['bin_id'], 'inventory_unit_id' => $location['inventory_unit_id'] ?? null, 'quantity' => $item->quantity];
            })->all();
            $order = $this->sales->create(['customer_id' => $build->customer_id, 'notes' => "PC build {$build->number}", 'tax_rate' => 0, 'items' => $orderItems]);
            $old = $build->toArray();
            $build->update(['sales_order_id' => $order->id, 'status' => 'converted']);
            $this->audit->record('pc-builds.converted', $build, $old, $build->fresh()->toArray());
            return $order;
        }, 5);
    }

    public function save(array $data, ?int $id = null): PcBuild
    {
        return DB::transaction(function () use ($data, $id): PcBuild {
            $build = $id ? PcBuild::query()->lockForUpdate()->findOrFail($id) : null;
            $before = null;
            $existing = collect();
            if ($build) {
                $existing = $build->items()->lockForUpdate()->get()->keyBy('component_type');
                $this->assertDraft($build, $existing->contains(fn ($item) => (bool) $item->is_reserved));
                $before = $build->load(['items', 'requirement'])->toArray();
            }
            $products = Product::query()->whereIn('id', array_column($data['items'], 'product_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            if (!$build) {
                $build = PcBuild::query()->create([
                    'number' => 'PCB-'.now()->format('YmdHis').'-'.str()->upper(str()->random(4)),
                    'created_by' => auth()->id(),
                ]);
            }
            $total = 0;
            foreach ($data['items'] as $item) {
                $product = $products->get($item['product_id']);
                if (!$product) throw ValidationException::withMessages(['items' => 'A selected product no longer exists.']);
                $old = $existing->get($item['component_type']);
                // Keep quoted prices for unchanged components; new components use current prices.
                $price = $old && (int) $old->product_id === (int) $product->id ? $old->unit_price : $product->selling_price;
                $total += (float) $price * (float) $item['quantity'];
                $build->items()->updateOrCreate(['component_type' => $item['component_type']], [
                    'product_id' => $product->id, 'quantity' => $item['quantity'], 'unit_price' => $price,
                ]);
            }
            $build->items()->whereNotIn('component_type', array_column($data['items'], 'component_type'))->delete();
            if (!$id || array_key_exists('requirements', $data)) {
                $build->requirement()->updateOrCreate([], ['requirements' => $data['requirements'] ?? []]);
            }
            $build->update([
                'customer_id' => $data['customer_id'] ?? null, 'budget' => $data['budget'] ?? null,
                'notes' => $data['notes'] ?? null, 'estimated_total' => $total,
            ]);
            $build->refresh()->load(['items', 'requirement']);
            $this->audit->record($id ? 'pc-builds.updated' : 'pc-builds.created', $build, $before, $build->toArray());

            return $build;
        }, 5);
    }

    public function delete(int $id): void
    {
        DB::transaction(function () use ($id): void {
            $build = PcBuild::query()->lockForUpdate()->findOrFail($id);
            $items = $build->items()->lockForUpdate()->get();
            $this->assertDraft($build, $items->contains(fn ($item) => (bool) $item->is_reserved));
            $before = $build->load(['items', 'requirement'])->toArray();
            // Only this unused draft and its component/requirement rows are removed.
            $build->delete();
            $this->audit->record('pc-builds.deleted', $build, $before, null);
        }, 5);
    }

    private function assertDraft(PcBuild $build, bool $reserved): void
    {
        $types = [$build->getMorphClass(), 'pc_build', 'pc_builds', 'pc-builds'];
        $linked = DB::table('warranties')->where('reference_id', $build->id)->whereIn('reference_type', $types)->exists()
            || DB::table('stock_movements')->where('reference_id', $build->id)->whereIn('reference_type', $types)->exists();
        if ($build->status !== 'draft' || $build->sales_order_id || $reserved || $linked) {
            throw ValidationException::withMessages(['build' => 'Only unlinked draft builds with no reserved components can be edited or deleted.']);
        }
    }
}
