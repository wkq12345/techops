<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class RecordCodeService
{
    // One source of truth for server-owned business identifiers.
    private const DEFINITIONS = [
        'customers' => ['table' => 'customers', 'field' => 'customer_code', 'prefix' => 'CUS'],
        'suppliers' => ['table' => 'suppliers', 'field' => 'supplier_code', 'prefix' => 'SUP'],
        'products' => ['table' => 'products', 'field' => 'sku', 'prefix' => 'PRD'],
        'warehouses' => ['table' => 'warehouses', 'field' => 'code', 'prefix' => 'WH'],
        'warehouse-bins' => ['table' => 'warehouse_bins', 'field' => 'code', 'prefix' => 'BIN'],
        'warranties' => ['table' => 'warranties', 'field' => 'number', 'prefix' => 'WAR'],
        'warranty-claims' => ['table' => 'warranty_claims', 'field' => 'number', 'prefix' => 'WCL'],
    ];

    public static function field(string $resource): ?string
    {
        return self::DEFINITIONS[$resource]['field'] ?? null;
    }

    public function next(string $resource): string
    {
        $definition = self::DEFINITIONS[$resource] ?? throw new InvalidArgumentException('No code definition for this resource.');

        return DB::transaction(function () use ($resource, $definition): string {
            // The primary key serializes even simultaneous first-time allocations.
            DB::table('record_code_sequences')->insertOrIgnore(['resource' => $resource, 'last_value' => 0]);
            $sequence = DB::table('record_code_sequences')->where('resource', $resource)->lockForUpdate()->first();
            $value = (int) $sequence->last_value;

            if ($value === 0) {
                // Preserve legacy codes and start beyond any existing matching sequence.
                $existing = DB::table($definition['table'])->where($definition['field'], 'like', $definition['prefix'].'-%')->pluck($definition['field']);
                foreach ($existing as $code) {
                    if (preg_match('/^'.preg_quote($definition['prefix'], '/').'-(\d+)$/', $code, $matches)) {
                        $value = max($value, (int) $matches[1]);
                    }
                }
            }

            do {
                $code = $definition['prefix'].'-'.str_pad((string) ++$value, 6, '0', STR_PAD_LEFT);
            } while (DB::table($definition['table'])->where($definition['field'], $code)->exists());

            DB::table('record_code_sequences')->where('resource', $resource)->update(['last_value' => $value]);

            return $code;
        }, 5);
    }
}
