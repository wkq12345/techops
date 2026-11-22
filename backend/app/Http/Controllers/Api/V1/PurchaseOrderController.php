<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GoodsReceiptRequest;
use App\Http\Requests\PurchaseOrderRequest;
use App\Models\PurchaseOrder;
use App\Services\PurchasingService;
use App\Support\TablePagination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    public function __construct(private readonly PurchasingService $purchasing) {}

    public function index(Request $request): JsonResponse
    {
        $query = PurchaseOrder::query()
            ->leftJoin('suppliers as purchase_order_supplier', 'purchase_order_supplier.id', '=', 'purchase_orders.supplier_id')
            ->select('purchase_orders.*', 'purchase_order_supplier.company_name as supplier_name');
        $search = $request->string('search')->trim()->toString();

        if ($search !== '') {
            $operator = $query->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $pattern = '%'.$search.'%';

            $query->where(function (Builder $orders) use ($operator, $pattern): void {
                $orders->where('number', $operator, $pattern)
                    ->orWhereHas('supplier', function (Builder $suppliers) use ($operator, $pattern): void {
                        $suppliers->where('company_name', $operator, $pattern)
                            ->orWhere('supplier_code', $operator, $pattern)
                            ->orWhere('contact_person', $operator, $pattern)
                            ->orWhere('email', $operator, $pattern)
                            ->orWhere('phone', $operator, $pattern);
                    });
            });
        }

        return response()->json(TablePagination::paginate($query->orderByDesc('id'), 'purchase-orders', $request->only(['sort_by', 'sort_direction', 'page']), $request->integer('per_page', 30)));
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json(['data' => $purchaseOrder->load('items')]);
    }

    public function store(PurchaseOrderRequest $r): JsonResponse
    {
        return response()->json(['data' => $this->purchasing->create($r->validated()), 'message' => 'Purchase order created.'], 201);
    }

    public function approve(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json(['data' => $this->purchasing->approve($purchaseOrder), 'message' => 'Purchase order approved.']);
    }

    public function receive(GoodsReceiptRequest $r, PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json(['data' => $this->purchasing->receive($purchaseOrder, $r->validated()), 'message' => 'Goods received into inventory.'], 201);
    }
}
