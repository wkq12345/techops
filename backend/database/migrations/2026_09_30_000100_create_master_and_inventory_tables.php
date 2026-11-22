<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->id();
            $table->string('customer_code')->unique();
            $table->string('name');
            $table->string('email')->nullable()->index();
            $table->string('phone')->nullable()->index();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('suppliers', function (Blueprint $table): void {
            $table->id();
            $table->string('supplier_code')->unique();
            $table->string('company_name');
            $table->string('contact_person')->nullable();
            $table->string('email')->nullable()->index();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('active')->index();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('brands', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->string('status')->default('active')->index();
            $table->timestamps();
        });
        Schema::create('categories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('status')->default('active')->index();
            $table->timestamps();
            $table->index('parent_id');
        });
        Schema::create('attributes', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->string('slug')->unique();
            $table->string('data_type')->default('text');
            $table->string('unit')->nullable();
            $table->timestamps();
        });
        Schema::create('products', function (Blueprint $table): void {
            $table->id();
            $table->string('sku')->unique();
            $table->string('name');
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('brand_id')->nullable()->constrained()->nullOnDelete();
            $table->string('product_type')->default('physical')->index();
            $table->string('tracking_type')->default('quantity')->index();
            $table->decimal('cost_price', 14, 2)->default(0);
            $table->decimal('selling_price', 14, 2)->default(0);
            $table->unsignedInteger('warranty_months')->default(0);
            $table->decimal('reorder_level', 14, 3)->default(0);
            $table->string('status')->default('active')->index();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['category_id', 'status']);
            $table->index(['brand_id', 'status']);
        });
        Schema::create('product_attribute_values', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('attribute_id')->constrained()->cascadeOnDelete();
            $table->text('value');
            $table->timestamps();
            $table->unique(['product_id', 'attribute_id']);
            $table->index('attribute_id');
        });
        Schema::create('warehouses', function (Blueprint $table): void {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('address')->nullable();
            $table->string('status')->default('active')->index();
            $table->timestamps();
        });
        Schema::create('warehouse_bins', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->string('code')->unique();
            $table->string('zone')->nullable();
            $table->string('rack')->nullable();
            $table->string('shelf')->nullable();
            $table->string('bin')->nullable();
            $table->timestamps();
            $table->index('warehouse_id');
        });
        Schema::create('inventory_stock', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->foreignId('warehouse_id')->constrained()->cascadeOnDelete();
            $table->decimal('quantity', 14, 3)->default(0);
            $table->decimal('reserved_quantity', 14, 3)->default(0);
            $table->timestamps();
            $table->unique(['product_id', 'warehouse_id']);
            $table->index('warehouse_id');
        });
        Schema::create('inventory_units', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('serial_number')->nullable()->unique();
            $table->string('imei')->nullable()->unique();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->foreignId('bin_id')->nullable()->constrained('warehouse_bins')->nullOnDelete();
            $table->string('status')->default('available')->index();
            $table->decimal('cost_price', 14, 2)->default(0);
            $table->timestampTz('received_at')->nullable();
            $table->date('warranty_start')->nullable();
            $table->date('warranty_end')->nullable();
            $table->timestamps();
            $table->index(['product_id', 'status']);
            $table->index(['warehouse_id', 'status']);
            $table->index('bin_id');
        });
        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('inventory_unit_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->string('movement_type')->index();
            $table->decimal('quantity', 14, 3);
            $table->nullableMorphs('reference');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->index(['product_id', 'created_at']);
            $table->index(['warehouse_id', 'created_at']);
            $table->index('inventory_unit_id');
            $table->index('created_by');
        });
        Schema::create('stock_adjustments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('warehouse_id')->constrained()->restrictOnDelete();
            $table->decimal('quantity_delta', 14, 3);
            $table->text('reason');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['product_id', 'warehouse_id']);
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('inventory_units');
        Schema::dropIfExists('inventory_stock');
        Schema::dropIfExists('warehouse_bins');
        Schema::dropIfExists('warehouses');
        Schema::dropIfExists('product_attribute_values');
        Schema::dropIfExists('products');
        Schema::dropIfExists('attributes');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('brands');
        Schema::dropIfExists('suppliers');
        Schema::dropIfExists('customers');
    }
};
