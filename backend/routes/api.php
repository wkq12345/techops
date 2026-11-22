<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DomainResourceController;
use App\Http\Controllers\Api\V1\InventoryController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PcBuildController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\RepairController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\ReturnController;
use App\Http\Controllers\Api\V1\SalesOrderController;
use App\Http\Controllers\Api\V1\UserManagementController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login'])->middleware(['guest', 'throttle:6,1']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware(['guest', 'throttle:6,1']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('guest');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/user', [AuthController::class, 'user']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::put('/password', [AuthController::class, 'changePassword'])->middleware('throttle:6,1');
    });
});

Route::prefix('v1')->middleware('auth:sanctum')->group(function (): void {
    Route::apiResource('users', UserManagementController::class)->parameters(['users' => 'id'])->middleware('can:users.manage');
    Route::get('inventory', [InventoryController::class, 'index'])->middleware('can:inventory.view');
    Route::get('inventory/replenishment-suggestions', [InventoryController::class, 'replenishmentSuggestions'])->middleware('can:inventory.view');
    Route::get('products/{product}/inventory-locations', [InventoryController::class, 'locations'])->middleware('can:products.view');
    Route::post('stock-adjustments', [InventoryController::class, 'adjust'])->middleware('can:inventory.adjust');
    Route::post('stock-transfers', [InventoryController::class, 'transfer'])->middleware('can:inventory.transfer');

    Route::get('sales-orders', [SalesOrderController::class, 'index'])->middleware('can:sales.create');
    Route::get('sales-orders/{salesOrder}', [SalesOrderController::class, 'show'])->middleware('can:sales.create');
    Route::post('sales-orders', [SalesOrderController::class, 'store'])->middleware('can:sales.create');
    Route::post('sales-orders/{salesOrder}/complete', [SalesOrderController::class, 'complete'])->middleware('can:sales.approve');
    Route::delete('sales-orders/{salesOrder}', [SalesOrderController::class, 'destroy'])->middleware('can:records.delete');

    Route::get('repairs', [RepairController::class, 'index'])->middleware('can:repairs.view');
    Route::get('repairs/intake-lookup', [RepairController::class, 'lookup'])->middleware('can:repairs.view');
    Route::get('repairs/{repair}', [RepairController::class, 'show'])->middleware('can:repairs.view');
    Route::post('repairs', [RepairController::class, 'store'])->middleware('can:repairs.update');
    Route::post('repairs/{repair}/status', [RepairController::class, 'status'])->middleware('can:repairs.update');
    Route::post('repairs/{repair}/parts', [RepairController::class, 'addPart'])->middleware('can:repairs.update');

    Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->middleware('can:purchases.create');
    Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->middleware('can:purchases.create');
    Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->middleware('can:purchases.create');
    Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])->middleware('can:purchases.approve');
    Route::post('purchase-orders/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])->middleware('can:purchases.create');

    Route::get('pc-builds', [PcBuildController::class, 'index'])->middleware('can:sales.create');
    Route::get('pc-builds/{pcBuild}', [PcBuildController::class, 'show'])->middleware('can:sales.create');
    Route::post('pc-builds', [PcBuildController::class, 'store'])->middleware('can:sales.create');
    Route::post('pc-builds/{pcBuild}/duplicate', [PcBuildController::class, 'duplicate'])->middleware('can:sales.create');
    Route::post('pc-builds/{pcBuild}/accept', [PcBuildController::class, 'accept'])->middleware('can:sales.create');
    Route::post('pc-builds/{pcBuild}/convert', [PcBuildController::class, 'convert'])->middleware('can:sales.create');
    Route::match(['put', 'patch'], 'pc-builds/{pcBuild}', [PcBuildController::class, 'update'])->middleware('can:sales.create');
    Route::delete('pc-builds/{pcBuild}', [PcBuildController::class, 'destroy'])->middleware(['can:sales.create', 'can:records.delete']);
    Route::post('pc-builds/{pcBuild}/validate', [PcBuildController::class, 'validateBuild'])->middleware('can:sales.create');
    Route::get('reports/dashboard', [ReportController::class, 'dashboard'])->middleware('can:reports.view');
    Route::get('sales-returns', [ReturnController::class, 'index'])->middleware('can:sales.create');
    Route::post('sales-returns', [ReturnController::class, 'store'])->middleware('can:sales.approve');
    Route::get('audit-logs', [DomainResourceController::class, 'index'])->defaults('resource', 'audit-logs')->middleware('can:users.manage');
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::post('notifications/{id}/read', [NotificationController::class, 'read']);

    Route::get('{resource}', [DomainResourceController::class, 'index'])->whereIn('resource', ['customers', 'suppliers', 'brands', 'categories', 'attributes', 'products', 'warehouses', 'warehouse-bins', 'inventory-units', 'stock-movements', 'quotations', 'payments', 'invoices', 'purchase-requests', 'goods-receipts', 'warranties', 'warranty-claims', 'supplier-returns'])->middleware('can:products.view');
    Route::post('{resource}', [DomainResourceController::class, 'store'])->whereIn('resource', ['customers', 'suppliers', 'brands', 'categories', 'attributes', 'products', 'warehouses', 'warehouse-bins', 'warranties', 'warranty-claims'])->middleware('can:products.create');
    Route::get('{resource}/{id}', [DomainResourceController::class, 'show'])->whereIn('resource', ['customers', 'suppliers', 'brands', 'categories', 'attributes', 'products', 'warehouses', 'warehouse-bins', 'inventory-units', 'quotations', 'invoices', 'warranties', 'warranty-claims', 'sales-returns', 'supplier-returns'])->middleware('can:products.view');
    Route::put('{resource}/{id}', [DomainResourceController::class, 'update'])->whereIn('resource', ['customers', 'suppliers', 'brands', 'categories', 'attributes', 'products', 'warehouses', 'warehouse-bins', 'warranties', 'warranty-claims'])->middleware('can:products.update');
    Route::delete('{resource}/{id}', [DomainResourceController::class, 'destroy'])->whereIn('resource', ['customers', 'suppliers', 'brands', 'categories', 'attributes', 'products', 'warehouses', 'warehouse-bins', 'warranties'])->middleware(['can:products.update', 'can:records.delete']);
});
