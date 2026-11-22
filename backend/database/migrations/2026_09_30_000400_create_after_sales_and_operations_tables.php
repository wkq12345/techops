<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('warranties', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->nullableMorphs('reference');
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('inventory_unit_id')->nullable()->constrained()->nullOnDelete();
            $t->date('warranty_start');
            $t->date('warranty_end');
            $t->string('warranty_type');
            $t->string('status')->default('active')->index();
            $t->timestamps();
            $t->index(['warranty_end', 'status']);
            $t->index('customer_id');
            $t->index('product_id');
            $t->index('inventory_unit_id');
        });
        Schema::create('warranty_claims', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('warranty_id')->constrained()->restrictOnDelete();
            $t->string('status')->default('submitted')->index();
            $t->text('issue');
            $t->text('resolution')->nullable();
            $t->foreignId('repair_job_id')->nullable()->constrained()->nullOnDelete();
            $t->timestamps();
            $t->index(['warranty_id', 'created_at']);
            $t->index('repair_job_id');
        });
        Schema::create('sales_returns', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('sales_order_id')->constrained()->restrictOnDelete();
            $t->string('status')->default('pending')->index();
            $t->text('notes')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['sales_order_id', 'created_at']);
            $t->index('created_by');
        });
        Schema::create('sales_return_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('sales_return_id')->constrained()->cascadeOnDelete();
            $t->foreignId('sales_order_item_id')->constrained()->restrictOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->foreignId('inventory_unit_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('quantity', 14, 3);
            $t->string('reason');
            $t->string('disposition');
            $t->decimal('refund_amount', 14, 2)->default(0);
            $t->timestamps();
            $t->index('sales_return_id');
            $t->index('sales_order_item_id');
            $t->index('product_id');
            $t->index('inventory_unit_id');
        });
        Schema::create('supplier_returns', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('supplier_id')->constrained()->restrictOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->foreignId('inventory_unit_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->decimal('quantity', 14, 3);
            $t->string('reason');
            $t->string('status')->default('pending')->index();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['supplier_id', 'created_at']);
            $t->index('product_id');
            $t->index('inventory_unit_id');
            $t->index('warehouse_id');
            $t->index('created_by');
        });
        Schema::create('audit_logs', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $t->string('action')->index();
            $t->string('entity_type');
            $t->unsignedBigInteger('entity_id')->nullable();
            $t->json('old_values')->nullable();
            $t->json('new_values')->nullable();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->timestampTz('created_at')->useCurrent();
            $t->index(['entity_type', 'entity_id']);
            $t->index(['user_id', 'created_at']);
        });
        Schema::create('notifications', function (Blueprint $t): void {
            $t->uuid('id')->primary();
            $t->string('type');
            $t->morphs('notifiable');
            $t->text('data');
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
            $t->index(['notifiable_type', 'notifiable_id', 'read_at']);
        });
    }

    public function down(): void
    {
        foreach (['notifications', 'audit_logs', 'supplier_returns', 'sales_return_items', 'sales_returns', 'warranty_claims', 'warranties'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
