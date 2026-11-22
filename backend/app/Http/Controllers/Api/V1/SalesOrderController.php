<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaymentRequest;
use App\Http\Requests\SalesOrderRequest;
use App\Models\SalesOrder;
use App\Services\SalesService;
use App\Support\TablePagination;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesOrderController extends Controller
{
    public function __construct(private readonly SalesService $sales) {}

    public function index(Request $request): JsonResponse
    {
        $query = SalesOrder::query()
            ->leftJoin('customers as sales_order_customer', 'sales_order_customer.id', '=', 'sales_orders.customer_id')
            ->select('sales_orders.*', 'sales_order_customer.name as customer_name');
        $search = $request->string('search')->trim()->toString();

        if ($search !== '') {
            $operator = $query->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $pattern = '%'.$search.'%';

            $query->where(function (Builder $orders) use ($operator, $pattern): void {
                $orders->where('number', $operator, $pattern)
                    ->orWhereHas('customer', function (Builder $customers) use ($operator, $pattern): void {
                        $customers->where('name', $operator, $pattern)
                            ->orWhere('customer_code', $operator, $pattern)
                            ->orWhere('email', $operator, $pattern)
                            ->orWhere('phone', $operator, $pattern);
                    });
            });
        }

        return response()->json(TablePagination::paginate($query->orderByDesc('id'), 'sales-orders', $request->only(['sort_by', 'sort_direction', 'page']), $request->integer('per_page', 30)));
    }

    public function show(SalesOrder $salesOrder): JsonResponse
    {
        return response()->json(['data' => $salesOrder->load(['items.location:id,code,name', 'items.warehouse:id,code,name', 'items.product:id,sku,name,tracking_type'])]);
    }

    public function store(SalesOrderRequest $r): JsonResponse
    {
        return response()->json(['data' => $this->sales->create($r->validated()), 'message' => 'Sales order created and stock reserved.'], 201);
    }

    public function complete(PaymentRequest $r, SalesOrder $salesOrder): JsonResponse
    {
        return response()->json(['data' => $this->sales->complete($salesOrder, $r->validated()), 'message' => 'Sale completed and invoice issued.']);
    }

    public function destroy(SalesOrder $salesOrder): JsonResponse
    {
        $this->sales->delete($salesOrder);

        return response()->json(['data' => null, 'message' => 'Sales order deleted. Reserved stock has been released.']);
    }
}
