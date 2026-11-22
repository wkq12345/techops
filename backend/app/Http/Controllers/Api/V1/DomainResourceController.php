<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DomainResourceRequest;
use App\Services\AuditService;
use App\Services\DomainResourceService;
use App\Services\OperationsCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DomainResourceController extends Controller
{
    public function __construct(private readonly DomainResourceService $resources, private readonly AuditService $audit, private readonly OperationsCache $cache) {}

    public function index(Request $request, string $resource): JsonResponse
    {
        $filters = $resource === 'products' ? $request->validate([
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]) : ($resource === 'inventory-units' ? $request->validate([
            'product_id' => ['sometimes', 'integer', 'exists:products,id'],
            'warehouse_id' => ['sometimes', 'integer', 'exists:warehouses,id'],
            'bin_id' => ['sometimes', 'integer', 'exists:warehouse_bins,id'],
            'status' => ['sometimes', Rule::in(['available', 'reserved', 'sold', 'repair', 'damaged', 'supplier_return'])],
        ]) : ($resource === 'warehouse-bins' ? $request->validate([
            'warehouse_id' => ['sometimes', 'integer', 'exists:warehouses,id'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]) : []));

        $load = fn () => $this->resources->paginate($resource, $request->string('search')->toString() ?: null, $request->integer('per_page', 20), $filters, $request->only(['sort_by', 'sort_direction', 'page']))->toArray();

        if (in_array($resource, ['brands', 'categories'], true)) {
            // Preserve both cursor selectors and searchable, sortable numbered tables.
            $data = $this->cache->remember($resource, ['url' => $request->fullUrl()], config('operations-cache.catalog_ttl'), $load);
        } else {
            $data = $load();
        }

        return response()->json($data);
    }

    public function store(DomainResourceRequest $request, string $resource): JsonResponse
    {
        $model = $this->resources->create($resource, $request->validated());
        $this->audit->record($resource.'.created', $model, null, $model->toArray());

        return response()->json(['data' => $model, 'message' => 'Created successfully.'], 201);
    }

    public function show(string $resource, int $id): JsonResponse
    {
        return response()->json(['data' => $this->resources->find($resource, $id)]);
    }

    public function update(DomainResourceRequest $request, string $resource, int $id): JsonResponse
    {
        $before = $this->resources->find($resource, $id)->toArray();
        $model = $this->resources->update($resource, $id, $request->validated());
        $this->audit->record($resource.'.updated', $model, $before, $model->toArray());

        return response()->json(['data' => $model, 'message' => 'Updated successfully.']);
    }

    public function destroy(string $resource, int $id): JsonResponse
    {
        DB::transaction(function () use ($resource, $id): void {
            $model = $this->resources->find($resource, $id);
            $before = $model->toArray();
            $this->resources->delete($resource, $id);
            $this->audit->record($resource.'.deleted', $model, $before, null);
        });

        return response()->json(['data' => null, 'message' => 'Deleted successfully.']);
    }
}
