<?php

namespace Database\Seeders;

use App\Models\Attribute;
use App\Models\Brand;
use App\Models\Category;
use App\Models\CompatibilityRule;
use App\Models\Customer;
use App\Models\InventoryStock;
use App\Models\Product;
use App\Models\ProductAttributeValue;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Warehouse;
use App\Models\WarehouseBin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $adminId = User::query()->where('email', env('ADMIN_EMAIL', 'admin@techops.local'))->value('id');
            $customer = Customer::query()->updateOrCreate(['customer_code' => 'CUS-0001'], ['name' => 'Aiman Rahman', 'email' => 'aiman@example.test', 'phone' => '+60 12-555 0101', 'address' => 'Kuala Lumpur']);
            Supplier::query()->updateOrCreate(['supplier_code' => 'SUP-0001'], ['company_name' => 'Digital Components Distribution', 'contact_person' => 'Sarah Lim', 'email' => 'orders@digitalcomponents.test', 'status' => 'active']);
            $brands = collect(['AMD', 'ASUS', 'Corsair', 'Dell', 'Intel', 'Kingston', 'NVIDIA', 'Samsung'])->mapWithKeys(fn ($name) => [$name => Brand::query()->updateOrCreate(['slug' => str($name)->slug()], ['name' => $name, 'status' => 'active'])]);
            $roots = [];
            foreach (['Computers', 'Phones', 'Components', 'Peripherals', 'Spare Parts', 'Services'] as $name) {
                $roots[$name] = Category::query()->updateOrCreate(['slug' => str($name)->slug()], ['name' => $name, 'status' => 'active']);
            }
            $children = ['Laptop' => 'Computers', 'CPU' => 'Components', 'Motherboard' => 'Components', 'RAM' => 'Components', 'SSD' => 'Components', 'GPU' => 'Components', 'PSU' => 'Components', 'Case' => 'Components', 'Cooler' => 'Components', 'Smartphone' => 'Phones'];
            $categories = [];
            foreach ($children as $name => $parent) {
                $categories[$name] = Category::query()->updateOrCreate(['slug' => str($name)->slug()], ['name' => $name, 'parent_id' => $roots[$parent]->id, 'status' => 'active']);
            }
            $warehouse = Warehouse::query()->updateOrCreate(['code' => 'WH01'], ['name' => 'Main Shop', 'status' => 'active']);
            Warehouse::query()->updateOrCreate(['code' => 'WH02'], ['name' => 'Repair Room', 'status' => 'active']);
            Warehouse::query()->updateOrCreate(['code' => 'WH03'], ['name' => 'Store Room', 'status' => 'active']);
            WarehouseBin::query()->updateOrCreate(['code' => 'WH01-A-R02-S03-B04'], ['warehouse_id' => $warehouse->id, 'zone' => 'A', 'rack' => 'R02', 'shelf' => 'S03', 'bin' => 'B04']);
            $attrs = [];
            foreach ([['Socket', 'socket', null], ['RAM Type', 'ram-type', null], ['Form Factor', 'form-factor', null], ['Supported Form Factors', 'supported-form-factors', null], ['Length', 'length-mm', 'mm'], ['Max GPU Length', 'max-gpu-length-mm', 'mm'], ['Height', 'height-mm', 'mm'], ['Max Cooler Height', 'max-cooler-height-mm', 'mm'], ['Wattage', 'wattage', 'W'], ['TDP', 'tdp-watts', 'W']] as [$name,$slug,$unit]) {
                $attrs[$slug] = Attribute::query()->updateOrCreate(['slug' => $slug], ['name' => $name, 'data_type' => $unit ? 'number' : 'text', 'unit' => $unit]);
            }
            $products = [
                ['AMD-9700X', 'AMD Ryzen 7 9700X', 'CPU', 'AMD', 1699, 1899, ['socket' => 'AM5', 'tdp-watts' => '65']],
                ['ASUS-B650P', 'ASUS TUF B650-PLUS', 'Motherboard', 'ASUS', 799, 949, ['socket' => 'AM5', 'ram-type' => 'DDR5', 'form-factor' => 'ATX', 'tdp-watts' => '60']],
                ['KNG-32-DDR5', 'Kingston Fury 32GB DDR5', 'RAM', 'Kingston', 399, 499, ['ram-type' => 'DDR5', 'tdp-watts' => '12']],
                ['SAM-990E-1T', 'Samsung 990 EVO 1TB', 'SSD', 'Samsung', 329, 429, ['tdp-watts' => '6']],
                ['ASUS-RTX5070', 'ASUS RTX 5070', 'GPU', 'ASUS', 2599, 2899, ['length-mm' => '300', 'tdp-watts' => '250']],
                ['COR-RM850E', 'Corsair RM850e', 'PSU', 'Corsair', 599, 699, ['wattage' => '850']],
                ['COR-4000D', 'Corsair 4000D Airflow', 'Case', 'Corsair', 399, 499, ['supported-form-factors' => 'ATX, Micro-ATX, Mini-ITX', 'max-gpu-length-mm' => '360', 'max-cooler-height-mm' => '170']],
                ['DELL-LAT5450', 'Dell Latitude 5450', 'Laptop', 'Dell', 4200, 4899, []],
                ['SVC-DIAG', 'Laptop Diagnostics', 'Services', null, 0, 80, []],
                ['SVC-ASSEMBLY', 'PC Assembly', 'Services', null, 0, 180, []],
            ];
            foreach ($products as [$sku,$name,$category,$brand,$cost,$price,$values]) {
                $product = Product::query()->updateOrCreate(['sku' => $sku], ['name' => $name, 'category_id' => ($categories[$category] ?? $roots[$category])->id, 'brand_id' => $brand ? $brands[$brand]->id : null, 'product_type' => str_starts_with($sku, 'SVC-') ? 'service' : 'physical', 'tracking_type' => str_starts_with($sku, 'SVC-') ? 'none' : 'quantity', 'cost_price' => $cost, 'selling_price' => $price, 'warranty_months' => str_starts_with($sku, 'SVC-') ? 1 : 36, 'reorder_level' => 2, 'status' => 'active']);
                foreach ($values as $slug => $value) {
                    ProductAttributeValue::query()->updateOrCreate(['product_id' => $product->id, 'attribute_id' => $attrs[$slug]->id], ['value' => $value]);
                }if ($product->tracking_type === 'quantity') {
                    InventoryStock::query()->updateOrCreate(['product_id' => $product->id, 'warehouse_id' => $warehouse->id], ['quantity' => 10, 'reserved_quantity' => 0]);
                    StockMovement::query()->firstOrCreate(['product_id' => $product->id, 'warehouse_id' => $warehouse->id, 'movement_type' => 'purchase_receive', 'reference_type' => 'seed', 'reference_id' => $product->id], ['quantity' => 10, 'notes' => 'Initial demo stock', 'created_by' => $adminId, 'created_at' => now()]);
                }
            }
            foreach ([['cpu_socket', 'cpu', 'socket', '=', 'motherboard', 'socket'], ['ram_type', 'ram', 'ram-type', '=', 'motherboard', 'ram-type'], ['gpu_clearance', 'gpu', 'length-mm', '<=', 'case', 'max-gpu-length-mm']] as [$code,$left,$la,$op,$right,$ra]) {
                CompatibilityRule::query()->updateOrCreate(['code' => $code], ['left_component_type' => $left, 'left_attribute' => $la, 'operator' => $op, 'right_component_type' => $right, 'right_attribute' => $ra, 'severity' => 'incompatible', 'message_template' => $code.' compatibility failed', 'is_active' => true]);
            }
            unset($customer);
        });
    }
}
