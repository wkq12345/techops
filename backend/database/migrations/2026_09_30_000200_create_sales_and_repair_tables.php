<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotations', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->string('status')->default('draft')->index();
            $t->date('valid_until')->nullable();
            $t->decimal('subtotal', 14, 2)->default(0);
            $t->decimal('tax', 14, 2)->default(0);
            $t->decimal('total', 14, 2)->default(0);
            $t->text('notes')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['customer_id', 'created_at']);
            $t->index('created_by');
        });
        Schema::create('quotation_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('quotation_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $t->string('description');
            $t->decimal('quantity', 14, 3);
            $t->decimal('unit_price', 14, 2);
            $t->decimal('line_total', 14, 2);
            $t->timestamps();
            $t->index('quotation_id');
            $t->index('product_id');
        });
        Schema::create('sales_orders', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('quotation_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('customer_id')->nullable()->constrained()->nullOnDelete();
            $t->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $t->string('status')->default('draft')->index();
            $t->decimal('subtotal', 14, 2)->default(0);
            $t->decimal('tax', 14, 2)->default(0);
            $t->decimal('total', 14, 2)->default(0);
            $t->text('notes')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['customer_id', 'created_at']);
            $t->index(['warehouse_id', 'status']);
            $t->index('quotation_id');
            $t->index('created_by');
        });
        Schema::create('sales_order_items', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->foreignId('inventory_unit_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('quantity', 14, 3);
            $t->decimal('unit_cost', 14, 2);
            $t->decimal('unit_price', 14, 2);
            $t->decimal('line_total', 14, 2);
            $t->timestamps();
            $t->index('sales_order_id');
            $t->index('product_id');
            $t->index('inventory_unit_id');
        });
        Schema::create('payments', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('sales_order_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('amount', 14, 2);
            $t->string('method');
            $t->string('reference')->nullable()->index();
            $t->string('status')->default('completed')->index();
            $t->timestampTz('paid_at')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index('sales_order_id');
            $t->index('created_by');
        });
        Schema::create('invoices', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('sales_order_id')->unique()->constrained()->restrictOnDelete();
            $t->date('issued_at');
            $t->date('due_at')->nullable();
            $t->decimal('total', 14, 2);
            $t->string('status')->default('issued')->index();
            $t->timestamps();
        });
        Schema::create('repair_jobs', function (Blueprint $t): void {
            $t->id();
            $t->string('number')->unique();
            $t->foreignId('customer_id')->constrained()->restrictOnDelete();
            $t->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('status')->default('received')->index();
            $t->decimal('estimated_cost', 14, 2)->nullable();
            $t->decimal('final_cost', 14, 2)->nullable();
            $t->timestampTz('completed_at')->nullable();
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index(['technician_id', 'status']);
            $t->index(['customer_id', 'created_at']);
            $t->index('created_by');
        });
        Schema::create('repair_devices', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('repair_job_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('device_type');
            $t->string('brand')->nullable();
            $t->string('model')->nullable();
            $t->string('serial_number')->nullable()->index();
            $t->string('imei')->nullable()->index();
            $t->text('reported_problem');
            $t->text('accessories_received')->nullable();
            $t->text('physical_condition')->nullable();
            $t->timestamps();
        });
        Schema::create('repair_diagnoses', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('repair_job_id')->constrained()->cascadeOnDelete();
            $t->text('findings');
            $t->text('recommendation')->nullable();
            $t->decimal('quoted_cost', 14, 2)->nullable();
            $t->foreignId('diagnosed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index('repair_job_id');
            $t->index('diagnosed_by');
        });
        Schema::create('repair_parts', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('repair_job_id')->constrained()->cascadeOnDelete();
            $t->foreignId('product_id')->constrained()->restrictOnDelete();
            $t->foreignId('inventory_unit_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('quantity', 14, 3);
            $t->decimal('cost_price', 14, 2);
            $t->decimal('selling_price', 14, 2);
            $t->string('status')->default('reserved')->index();
            $t->timestamps();
            $t->index('repair_job_id');
            $t->index('product_id');
            $t->index('inventory_unit_id');
        });
        Schema::create('repair_status_history', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('repair_job_id')->constrained()->cascadeOnDelete();
            $t->string('from_status')->nullable();
            $t->string('to_status');
            $t->text('notes')->nullable();
            $t->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestampTz('created_at')->useCurrent();
            $t->index(['repair_job_id', 'created_at']);
            $t->index('changed_by');
        });
        Schema::create('repair_notes', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('repair_job_id')->constrained()->cascadeOnDelete();
            $t->text('note');
            $t->boolean('is_internal')->default(true);
            $t->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamps();
            $t->index('repair_job_id');
            $t->index('created_by');
        });
    }

    public function down(): void
    {
        foreach (['repair_notes', 'repair_status_history', 'repair_parts', 'repair_diagnoses', 'repair_devices', 'repair_jobs', 'invoices', 'payments', 'sales_order_items', 'sales_orders', 'quotation_items', 'quotations'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
