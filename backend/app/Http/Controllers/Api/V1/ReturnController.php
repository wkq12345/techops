<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SalesReturnRequest;
use App\Models\SalesReturn;
use App\Services\ReturnService;
use App\Support\TablePagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReturnController extends Controller
{
    public function __construct(private readonly ReturnService $returns) {}

    public function index(Request $request): JsonResponse
    {
        $query = SalesReturn::query()
            ->join('sales_orders as return_order', 'return_order.id', '=', 'sales_returns.sales_order_id')
            ->leftJoin('customers as return_customer', 'return_customer.id', '=', 'return_order.customer_id')
            ->select('sales_returns.*', 'return_order.number as sales_order_number', 'return_customer.name as customer_name')
            ->orderByDesc('sales_returns.id');

        return response()->json(TablePagination::paginate($query, 'sales-returns', $request->only(['sort_by', 'sort_direction', 'page']), $request->integer('per_page', 30)));
    }

    public function store(SalesReturnRequest $r): JsonResponse
    {
        return response()->json(['data' => $this->returns->create($r->validated()), 'message' => 'Return completed with inventory disposition.'], 201);
    }
}
