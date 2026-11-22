<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_requests', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->string('status')->default('draft')->index();
            $t->text('reason')->nullable();
            $t->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestampTz('approved_at')->nullable();
            $t->timestamps();
            $t->index('requested_by');
            $t->index('approved_by');
        });
        Schema::create('purchase_request_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('purchase_request_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->decimal('quantity', 14, 3);
            $t->text('notes')->nullable();
            $t->timestamps();
            $t->index('purchase_request_id');
            $t->index('product_id');
        });
        Schema::create('purchase_orders', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('purchase_request_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->string('status')->default('draft')->index();
            $t->date('ordered_at')->nullable();
            $t->date('expected_at')->nullable();
            $t->decimal('total', 14, 2)->default(0);
            $t->text('notes')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['supplier_id', 'status']);
            $t->index(['warehouse_id', 'status']);
            $t->index('purchase_request_id');
            $t->index('created_by');
            $t->index('approved_by');
        });
        Schema::create('purchase_order_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('purchase_order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->decimal('ordered_quantity', 14, 3);
            $t->decimal('received_quantity', 14, 3)->default(0);
            $t->decimal('unit_cost', 14, 2);
            $t->decimal('line_total', 14, 2);
            $t->timestamps();
            $t->index('purchase_order_id');
            $t->index('product_id');
        });
        Schema::create('goods_receipts', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('purchase_order_id')->constrained()->restrictOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->timestampTz('received_at');
            $t->text('notes')->nullable();
            $t->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['purchase_order_id', 'received_at']);
            $t->index('warehouse_id');
            $t->index('received_by');
        });
        Schema::create('goods_receipt_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('goods_receipt_id')->constrained()->cascadeOnDelete();
            $t->foreignId('purchase_order_item_id')->constrained()->restrictOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->decimal('quantity', 14, 3);
            $t->decimal('unit_cost', 14, 2);
            $t->json('serials')->nullable();
            $t->timestamps();
            $t->index('goods_receipt_id');
            $t->index('purchase_order_item_id');
            $t->index('product_id');
        });
        Schema::create('pc_builds', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('sales_order_id')->nullable()->constrained()->nullOnDelete();
            $t->string('status')->default('draft')->index();
            $t->decimal('budget', 14, 2)->nullable();
            $t->decimal('estimated_total', 14, 2)->default(0);
            $t->text('notes')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['customer_id', 'created_at']);
            $t->index('sales_order_id');
            $t->index('created_by');
        });
        Schema::create('pc_build_requirements', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('pc_build_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('usage_type')->nullable();
            $t->string('preferred_brand')->nullable();
            $t->string('gaming_resolution')->nullable();
            $t->unsignedInteger('target_fps')->nullable();
            $t->json('requirements')->nullable();
            $t->timestamps();
        });
        Schema::create('pc_build_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('pc_build_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->string('component_type')->index();
            $t->decimal('quantity', 14, 3)->default(1);
            $t->decimal('unit_price', 14, 2);
            $t->boolean('is_reserved')->default(false);
            $t->timestamps();
            $t->unique(['pc_build_id', 'component_type']);
            $t->index('product_id');
        });
        Schema::create('compatibility_rules', function (Blueprint $t): void {
            $t->id();
            $t->string('code')->unique();
            $t->string('left_component_type');
            $t->string('left_attribute');
            $t->string('operator');
            $t->string('right_component_type')->nullable();
            $t->string('right_attribute')->nullable();
            $t->decimal('factor', 10, 3)->nullable();
            $t->string('severity')->default('incompatible');
            $t->text('message_template');
            $t->boolean('is_active')->default(true)->index();
            $t->timestamps();
            $t->index(['left_component_type', 'right_component_type']);
        });
    }

    public function down(): void
    {
        foreach (['compatibility_rules', 'pc_build_items', 'pc_build_requirements', 'pc_builds', 'goods_receipt_items', 'goods_receipts', 'purchase_order_items', 'purchase_orders', 'purchase_request_items', 'purchase_requests'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
