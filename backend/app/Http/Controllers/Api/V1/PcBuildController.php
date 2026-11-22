<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PcBuildRequest;
use App\Models\PcBuild;
use App\Services\CompatibilityService;
use App\Services\PcBuildService;
use App\Support\TablePagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PcBuildController extends Controller
{
    public function __construct(private readonly CompatibilityService $compatibility, private readonly PcBuildService $builds) {}

    public function index(Request $request): JsonResponse
    {
        $query = PcBuild::query()
            ->leftJoin('customers as build_customer', 'build_customer.id', '=', 'pc_builds.customer_id')
            ->select('pc_builds.*', 'build_customer.name as customer_name')
            ->withCount(['items as reserved_items_count' => fn ($query) => $query->where('is_reserved', true)])
            ->orderByDesc('pc_builds.id');
        return response()->json(TablePagination::paginate($query, 'pc-builds', $request->only(['sort_by', 'sort_direction', 'page']), $request->integer('per_page', 30)));
    }

    public function show(PcBuild $pcBuild): JsonResponse
    {
        return response()->json(['data' => $pcBuild->load(['items', 'requirement'])]);
    }

    public function store(PcBuildRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->builds->save($request->validated()), 'message' => 'PC build created.'], 201);
    }

    public function update(PcBuildRequest $request, PcBuild $pcBuild): JsonResponse
    {
        return response()->json(['data' => $this->builds->save($request->validated(), $pcBuild->id), 'message' => 'PC build updated.']);
    }

    public function destroy(PcBuild $pcBuild): JsonResponse
    {
        $this->builds->delete($pcBuild->id);
        return response()->json(['data' => null, 'message' => 'Draft PC build deleted.']);
    }

    public function duplicate(PcBuild $pcBuild): JsonResponse
    {
        return response()->json(['data' => $this->builds->duplicate($pcBuild), 'message' => 'Build copied as a new draft.'], 201);
    }

    public function accept(PcBuild $pcBuild): JsonResponse
    {
        return response()->json(['data' => $this->builds->accept($pcBuild), 'message' => 'Build accepted after compatibility validation.']);
    }

    public function convert(Request $request, PcBuild $pcBuild): JsonResponse
    {
        $data = $request->validate(['items' => ['required', 'array', 'min:1'], 'items.*.pc_build_item_id' => ['required', 'integer', 'distinct'], 'items.*.product_id' => ['required', 'integer', 'exists:products,id'], 'items.*.warehouse_id' => ['required', 'integer', 'exists:warehouses,id'], 'items.*.bin_id' => ['required', 'integer', 'exists:warehouse_bins,id'], 'items.*.inventory_unit_id' => ['nullable', 'integer', 'exists:inventory_units,id']]);
        $order = $this->builds->convertToSalesOrder($pcBuild, $data['items']);
        return response()->json(['data' => $order, 'message' => 'Sales order created and stock reserved.'], 201);
    }

    public function validateBuild(PcBuild $pcBuild): JsonResponse
    {
        return response()->json(['data' => $this->compatibility->validate($pcBuild)]);
    }
}
