<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RepairJobRequest;
use App\Http\Requests\RepairPartRequest;
use App\Models\RepairJob;
use App\Models\RepairDevice;
use App\Models\InventoryUnit;
use App\Models\Warranty;
use App\Services\RepairService;
use App\Support\TablePagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RepairController extends Controller
{
    public function __construct(private readonly RepairService $repairs) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(TablePagination::paginate(RepairJob::query()->orderByDesc('id'), 'repairs', $request->only(['sort_by', 'sort_direction', 'page']), $request->integer('per_page', 30)));
    }

    public function show(RepairJob $repair): JsonResponse
    {
        return response()->json(['data' => $repair->load(['device', 'parts', 'statusHistory'])]);
    }

    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate(['serial' => ['required', 'string', 'max:255']]);
        $serial = trim($data['serial']);
        $jobs = RepairJob::query()->with(['device', 'customer:id,name,customer_code'])
            ->whereHas('device', fn ($query) => $query->where('serial_number', $serial)->orWhere('imei', $serial))
            ->orderByDesc('id')->limit(10)->get();
        $unit = InventoryUnit::query()->where('serial_number', $serial)->orWhere('imei', $serial)->first();
        $warranties = $unit ? Warranty::query()->where('inventory_unit_id', $unit->id)->whereIn('status', ['active', 'expired'])->orderByDesc('warranty_end')->limit(5)->get(['id', 'number', 'warranty_start', 'warranty_end', 'status']) : collect();

        return response()->json(['data' => ['repair_history' => $jobs, 'warranties' => $warranties]]);
    }

    public function store(RepairJobRequest $r): JsonResponse
    {
        return response()->json(['data' => $this->repairs->create($r->validated()), 'message' => 'Repair job opened.'], 201);
    }

    public function status(Request $r, RepairJob $repair): JsonResponse
    {
        $data = $r->validate(['status' => ['required', 'string'], 'notes' => ['nullable', 'string']]);

        return response()->json(['data' => $this->repairs->transition($repair, $data['status'], $data['notes'] ?? null), 'message' => 'Repair status updated.']);
    }

    public function addPart(RepairPartRequest $r, RepairJob $repair): JsonResponse
    {
        return response()->json(['data' => $this->repairs->addPart($repair, $r->validated()), 'message' => 'Part consumed from inventory.'], 201);
    }
}
