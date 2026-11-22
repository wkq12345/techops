<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reports) {}

    public function dashboard(): JsonResponse
    {
        return response()->json(['data' => $this->reports->dashboard()]);
    }
}
