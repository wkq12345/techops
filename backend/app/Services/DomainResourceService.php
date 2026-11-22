<?php

namespace App\Services;

use App\Models\Attribute;
use App\Models\AuditLog;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\GoodsReceipt;
use App\Models\InventoryUnit;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PcBuild;
use App\Models\Product;
use App\Models\PurchaseRequest;
use App\Models\Quotation;
use App\Models\SalesReturn;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierReturn;
use App\Models\Warehouse;
use App\Models\WarehouseBin;
use App\Models\Warranty;
use App\Models\WarrantyClaim;
use App\Support\TablePagination;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\CursorPaginator;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class DomainResourceService
{
    public function __construct(private readonly RecordCodeService $codes, private readonly InventoryLocationService $locations) {}

    private const DELETE_REFERENCES = [
        'customers' => ['customer_id', ['quotations', 'sales_orders', 'repair_jobs', 'pc_builds', 'warranties']],
        'suppliers' => ['supplier_id', ['purchase_orders', 'supplier_returns']],
        'products' => ['product_id', ['inventory_location_stock', 'inventory_stock', 'inventory_units', 'stock_movements', 'stock_adjustments', 'quotation_items', 'sales_order_items', 'repair_parts', 'purchase_request_items', 'purchase_order_items', 'goods_receipt_items', 'pc_build_items', 'warranties', 'sales_return_items', 'supplier_returns']],
        'warehouse-bins' => ['bin_id', ['inventory_location_stock', 'inventory_units', 'stock_movements', 'stock_adjustments', 'sales_order_items', 'goods_receipt_items', 'repair_parts', 'sales_return_items']],
        'warehouses' => ['warehouse_id', ['warehouse_bins', 'inventory_location_stock', 'inventory_stock', 'inventory_units', 'stock_movements', 'stock_adjustments', 'sales_orders', 'sales_order_items', 'purchase_orders', 'goods_receipts', 'supplier_returns']],
    ];

    private const MODELS = [
        'customers' => Customer::class, 'suppliers' => Supplier::class, 'brands' => Brand::class, 'categories' => Category::class, 'attributes' => Attribute::class, 'products' => Product::class, 'warehouses' => Warehouse::class, 'warehouse-bins' => WarehouseBin::class, 'inventory-units' => InventoryUnit::class, 'stock-movements' => StockMovement::class, 'quotations' => Quotation::class, 'payments' => Payment::class, 'invoices' => Invoice::class, 'purchase-requests' => PurchaseRequest::class, 'goods-receipts' => GoodsReceipt::class, 'pc-builds' => PcBuild::class, 'warranties' => Warranty::class, 'warranty-claims' => WarrantyClaim::class, 'sales-returns' => SalesReturn::class, 'supplier-returns' => SupplierReturn::class, 'audit-logs' => AuditLog::class,
    ];

    public function paginate(string $resource, ?string $search = null, int $perPage = 20, array $filters = [], array $listOptions = []): CursorPaginator|LengthAwarePaginator
    {
        $model = $this->model($resource);
        $query = $model::query()->orderByDesc($model->getQualifiedKeyName());
        if ($resource === 'categories') {
            if (isset($listOptions['sort_by']) && $listOptions['sort_by'] === 'parent') {
                $query->select('categories.*')
                    ->leftJoin('categories as parent_category', 'parent_category.id', '=', 'categories.parent_id')
                    ->selectRaw("coalesce(parent_category.name, 'Top level') as parent_name");
            }
            $query->with('parent:id,name')->withCount(['children', 'products']);
        }
        if ($resource === 'brands') {
            $query->withCount('products');
        }
        if ($resource === 'warranties') {
            $query->leftJoin('customers as warranty_customer', 'warranty_customer.id', '=', 'warranties.customer_id')
                ->select('warranties.*', 'warranty_customer.name as customer_name');
        }
        if ($resource === 'inventory-units') {
            $query->join('products', 'products.id', '=', 'inventory_units.product_id')
                ->join('warehouses', 'warehouses.id', '=', 'inventory_units.warehouse_id')
                ->leftJoin('warehouse_bins', 'warehouse_bins.id', '=', 'inventory_units.bin_id')
                ->select('inventory_units.*', 'products.name as product_name', 'warehouses.name as warehouse_name', 'warehouse_bins.name as location_name');
        }
        if ($resource === 'stock-movements') {
            $query->join('products', 'products.id', '=', 'stock_movements.product_id')
                ->join('warehouses', 'warehouses.id', '=', 'stock_movements.warehouse_id')
                ->leftJoin('warehouse_bins', 'warehouse_bins.id', '=', 'stock_movements.bin_id')
                ->select('stock_movements.*', 'products.name as product_name', 'warehouses.name as warehouse_name', 'warehouse_bins.name as location_name');
        }
        if ($resource === 'invoices') {
            $query->join('sales_orders as invoice_order', 'invoice_order.id', '=', 'invoices.sales_order_id')
                ->leftJoin('customers as invoice_customer', 'invoice_customer.id', '=', 'invoice_order.customer_id')
                ->select('invoices.*', 'invoice_order.number as sales_order_number', 'invoice_customer.name as customer_name');
        }
        if ($resource === 'repairs') {
            $query->join('customers as repair_customer', 'repair_customer.id', '=', 'repair_jobs.customer_id')
                ->leftJoin('users as repair_technician', 'repair_technician.id', '=', 'repair_jobs.technician_id')
                ->select('repair_jobs.*', 'repair_customer.name as customer_name', 'repair_technician.name as technician_name');
        }
        if ($resource === 'goods-receipts') {
            $query->join('purchase_orders as receipt_order', 'receipt_order.id', '=', 'goods_receipts.purchase_order_id')
                ->join('warehouses as receipt_warehouse', 'receipt_warehouse.id', '=', 'goods_receipts.warehouse_id')
                ->select('goods_receipts.*', 'receipt_order.number as purchase_order_number', 'receipt_warehouse.name as warehouse_name');
        }
        if ($resource === 'audit-logs') {
            $query->leftJoin('users as audit_user', 'audit_user.id', '=', 'audit_logs.user_id')
                ->select('audit_logs.*', 'audit_user.name as user_name');
        }
        if ($resource === 'warehouse-bins') {
            $query->join('warehouses', 'warehouses.id', '=', 'warehouse_bins.warehouse_id')
                ->select('warehouse_bins.*', 'warehouses.name as warehouse_name')->withCount('stocks');
            foreach (['warehouse_id', 'status'] as $column) {
                if (isset($filters[$column])) $query->where('warehouse_bins.'.$column, $filters[$column]);
            }
        }
        if ($resource === 'products') {
            if (isset($filters['category_id'])) {
                $ids = [(int) $filters['category_id']];
                $frontier = $ids;
                while ($frontier) {
                    $frontier = Category::query()->whereIn('parent_id', $frontier)->whereNotIn('id', $ids)->pluck('id')->all();
                    $ids = array_merge($ids, $frontier);
                }
                $query->whereIn('category_id', $ids);
            }
            if (isset($filters['status'])) {
                $query->where('status', $filters['status']);
            }
        }
        if ($resource === 'inventory-units') {
            foreach (['product_id', 'warehouse_id', 'bin_id', 'status'] as $column) {
                if (isset($filters[$column])) $query->where($column, $filters[$column]);
            }
        }
        if ($search) {
            $columns = ['code', 'name', 'number', 'sku', 'customer_code', 'supplier_code', 'company_name', 'email'];
            $query->where(function ($q) use ($columns, $search, $model) {
                foreach ($columns as $column) {
                    if (in_array($column, $model->getConnection()->getSchemaBuilder()->getColumnListing($model->getTable()), true)) {
                        $q->orWhere($model->qualifyColumn($column), $model->getConnection()->getDriverName() === 'pgsql' ? 'ilike' : 'like', '%'.$search.'%');
                    }
                }
            });
        }

        return TablePagination::paginate($query, $resource, $listOptions, $perPage);
    }

    public function create(string $resource, array $data): Model
    {
        $class = $this->class($resource);

        return DB::transaction(function () use ($resource, $class, $data): Model {
            if ($resource === 'warranties') {
                $start = CarbonImmutable::today();
                $months = (int) $data['warranty_months'];
                unset($data['warranty_months']);
                $data['warranty_start'] = $start->toDateString();
                $data['warranty_end'] = $start->addMonthsNoOverflow($months)->toDateString();
                $data['warranty_type'] = 'standard';
            }
            if ($resource === 'categories') {
                $this->validateCategoryParent(null, $data['parent_id'] ?? null);
            }
            if (in_array($resource, ['categories', 'brands'], true)) {
                $data['slug'] = (Str::slug(Str::limit($data['name'], 190, '')) ?: Str::singular($resource)).'-'.Str::uuid();
            }
            if ($field = RecordCodeService::field($resource)) {
                $data[$field] = $this->codes->next($resource);
            }

            if ($resource === 'warehouse-bins') {
                $warehouse = Warehouse::query()->lockForUpdate()->findOrFail($data['warehouse_id']);
                if ($warehouse->status !== 'active') throw ValidationException::withMessages(['warehouse_id' => 'Select an active warehouse.']);
            }
            $record = $class::query()->create($data);
            if ($resource === 'warehouses') $this->locations->unassigned($record->id);
            return $record;
        }, 5);
    }

    public function find(string $resource, int $id): Model
    {
        $record = $this->class($resource)::query()->findOrFail($id);
        if ($resource === 'invoices') {
            $record->load(['salesOrder.customer', 'salesOrder.items.product']);
        }

        return $record;
    }

    public function update(string $resource, int $id, array $data): Model
    {
        if ($resource === 'warranties' && array_key_exists('warranty_months', $data)) {
            $months = (int) $data['warranty_months'];
            unset($data['warranty_months']);
            $warranty = Warranty::query()->findOrFail($id);
            $data['warranty_end'] = CarbonImmutable::parse($warranty->warranty_start)->addMonthsNoOverflow($months)->toDateString();
        }
        if ($resource === 'categories') {
            return DB::transaction(function () use ($id, $data): Model {
                // Serialize hierarchy changes so concurrent re-parenting cannot create a cycle.
                Category::query()->orderBy('id')->lockForUpdate()->get(['id']);
                $this->validateCategoryParent($id, $data['parent_id'] ?? null);
                unset($data['slug']);
                $model = $this->find('categories', $id);
                $model->update($data);

                return $model->fresh();
            }, 5);
        }
        if ($resource === 'warehouse-bins') {
            return DB::transaction(function () use ($id, $data): Model {
                $record = $this->find('warehouse-bins', $id);
                Warehouse::query()->whereKey($record->warehouse_id)->lockForUpdate()->firstOrFail();
                $record = WarehouseBin::query()->lockForUpdate()->findOrFail($id);
                if ($record->is_unassigned) throw ValidationException::withMessages(['location' => 'The system Unassigned location cannot be edited.']);
                if ((int) $data['warehouse_id'] !== (int) $record->warehouse_id) throw ValidationException::withMessages(['warehouse_id' => 'A location cannot be moved to another warehouse. Transfer its stock instead.']);
                unset($data['code'], $data['is_unassigned']);
                $record->update($data);
                return $record->fresh();
            }, 5);
        }
        $model = $this->find($resource, $id);
        if ($resource === 'brands') {
            unset($data['slug']);
        }
        if ($field = RecordCodeService::field($resource)) {
            unset($data[$field]);
        }
        $model->update($data);

        return $model->fresh();
    }

    public function delete(string $resource, int $id): void
    {
        if ($resource === 'warranties' && WarrantyClaim::query()->where('warranty_id', $id)->exists()) {
            throw ValidationException::withMessages(['warranty' => 'This warranty has claims and cannot be deleted.']);
        }
        if (in_array($resource, ['categories', 'brands'], true)) {
            DB::transaction(function () use ($resource, $id): void {
                $record = $this->class($resource)::query()->lockForUpdate()->findOrFail($id);
                if ($record->products()->exists() || ($resource === 'categories' && $record->children()->exists())) {
                    $name = Str::singular($resource);
                    $linked = $resource === 'categories' ? 'products or subcategories' : 'products';
                    throw ValidationException::withMessages([$name => "This {$name} contains {$linked}. Reassign them first, or mark the {$name} inactive instead."]);
                }
                $record->delete();
            });

            return;
        }
        DB::transaction(function () use ($resource, $id): void {
            if ($resource === 'warehouse-bins') {
                $location = $this->find($resource, $id);
                Warehouse::query()->whereKey($location->warehouse_id)->lockForUpdate()->firstOrFail();
            }
            $record = $this->class($resource)::query()->lockForUpdate()->findOrFail($id);
            if ($resource === 'warehouse-bins' && $record->is_unassigned) throw ValidationException::withMessages(['location' => 'The system Unassigned location cannot be deleted.']);
            if ($resource === 'warehouses') {
                foreach (self::DELETE_REFERENCES['warehouse-bins'][1] as $table) {
                    if (DB::table($table)->whereIn('bin_id', WarehouseBin::query()->where('warehouse_id', $id)->select('id'))->exists()) {
                        throw ValidationException::withMessages(['warehouse' => 'This warehouse has location stock or business history and cannot be deleted.']);
                    }
                }
            }
            if (isset(self::DELETE_REFERENCES[$resource])) {
                [$column, $tables] = self::DELETE_REFERENCES[$resource];
                foreach ($tables as $table) {
                    $references = DB::table($table)->where($column, $id);
                    if ($resource === 'warehouses' && $table === 'warehouse_bins') $references->where('is_unassigned', false);
                    if ($references->exists()) {
                        $name = $resource === 'warehouse-bins' ? 'inventory location' : Str::singular($resource);
                        throw ValidationException::withMessages([$name => "This {$name} is linked to stock or business records and cannot be deleted. Update its details instead."]);
                    }
                }
            }
            $record->delete();
        });
    }

    private function validateCategoryParent(?int $id, mixed $parentId): void
    {
        $visited = [];
        while ($parentId) {
            $parentId = (int) $parentId;
            if ($parentId === $id || isset($visited[$parentId])) {
                throw ValidationException::withMessages(['parent_id' => 'A category cannot be its own parent or belong to one of its descendants.']);
            }
            $visited[$parentId] = true;
            $parentId = Category::query()->findOrFail($parentId)->parent_id;
        }
    }

    private function class(string $resource): string
    {
        return self::MODELS[$resource] ?? throw new InvalidArgumentException('Unsupported resource.');
    }

    private function model(string $resource): Model
    {
        $class = $this->class($resource);

        return new $class;
    }
}
