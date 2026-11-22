<?php

namespace App\Services;

use App\Models\PcBuild;
use App\Models\PcBuildItem;
use App\Models\ProductAttributeValue;

class CompatibilityService
{
    public function validate(PcBuild $build): array
    {
        $items = PcBuildItem::query()->where('pc_build_id', $build->id)->get()->keyBy('component_type');
        $attributes = ProductAttributeValue::query()->join('attributes', 'attributes.id', '=', 'product_attribute_values.attribute_id')->whereIn('product_id', $items->pluck('product_id'))->get(['product_id', 'attributes.slug', 'product_attribute_values.value'])->groupBy('product_id')->map(fn ($rows) => $rows->pluck('value', 'slug'));
        $results = [];
        $this->equalRule($results, $items, $attributes, 'cpu', 'socket', 'motherboard', 'socket', 'cpu_socket');
        $this->equalRule($results, $items, $attributes, 'ram', 'ram-type', 'motherboard', 'ram-type', 'ram_type');
        $this->containsRule($results, $items, $attributes, 'motherboard', 'form-factor', 'case', 'supported-form-factors', 'motherboard_case');
        $this->maxRule($results, $items, $attributes, 'gpu', 'length-mm', 'case', 'max-gpu-length-mm', 'gpu_clearance');
        $this->maxRule($results, $items, $attributes, 'cooler', 'height-mm', 'case', 'max-cooler-height-mm', 'cooler_clearance');
        if (isset($items['psu'])) {
            $psu = (float) ($attributes[$items['psu']->product_id]['wattage'] ?? 0);
            $required = 0;
            $powerComponents = $items->only(['cpu', 'gpu']);
            $incompletePowerData = $powerComponents->isEmpty();
            foreach ($powerComponents as $item) {
                $tdp = (float) ($attributes[$item->product_id]['tdp-watts'] ?? 0);
                if ($tdp <= 0) $incompletePowerData = true;
                $required += $tdp;
            }$required *= 1.2;
            if ($psu <= 0 || $incompletePowerData) {
                $results[] = ['status' => 'warning', 'rule' => 'psu_wattage', 'message' => 'Add PSU wattage and CPU/GPU TDP attributes to verify power capacity.'];
            } else {
                $results[] = ['status' => $psu >= $required ? 'compatible' : 'incompatible', 'rule' => 'psu_wattage', 'message' => $psu >= $required ? "PSU capacity {$psu}W covers the estimated load." : "PSU capacity {$psu}W is below the recommended {$required}W."];
            }
        }
        if ($results === []) {
            $results[] = ['status' => 'warning', 'rule' => 'insufficient_data', 'message' => 'Add component attributes to run all compatibility checks.'];
        }

        return ['status' => collect($results)->contains('status', 'incompatible') ? 'incompatible' : (collect($results)->contains('status', 'warning') ? 'warning' : 'compatible'), 'results' => $results];
    }

    private function equalRule(array &$out, $items, $attrs, string $left, string $la, string $right, string $ra, string $rule): void
    {
        if (! isset($items[$left],$items[$right])) {
            return;
        }$lv = $attrs[$items[$left]->product_id][$la] ?? null;
        $rv = $attrs[$items[$right]->product_id][$ra] ?? null;
        if ($lv && $rv) {
            $matches = strtolower(trim((string) $lv)) === strtolower(trim((string) $rv));
            $out[] = ['status' => $matches ? 'compatible' : 'incompatible', 'rule' => $rule, 'message' => $matches ? "{$rule} is compatible." : "{$left} requires {$lv}, but {$right} provides {$rv}."];
        }
    }

    private function containsRule(array &$out, $items, $attrs, string $left, string $la, string $right, string $ra, string $rule): void
    {
        if (! isset($items[$left],$items[$right])) {
            return;
        }$lv = $attrs[$items[$left]->product_id][$la] ?? null;
        $rv = $attrs[$items[$right]->product_id][$ra] ?? null;
        if ($lv && $rv) {
            $out[] = ['status' => str_contains(strtolower($rv), strtolower($lv)) ? 'compatible' : 'incompatible', 'rule' => $rule, 'message' => str_contains(strtolower($rv), strtolower($lv)) ? "{$rule} is compatible." : "{$right} does not list {$lv} support."];
        }
    }

    private function maxRule(array &$out, $items, $attrs, string $left, string $la, string $right, string $ra, string $rule): void
    {
        if (! isset($items[$left],$items[$right])) {
            return;
        }$lv = (float) ($attrs[$items[$left]->product_id][$la] ?? 0);
        $rv = (float) ($attrs[$items[$right]->product_id][$ra] ?? 0);
        if ($lv && $rv) {
            $out[] = ['status' => $lv <= $rv ? 'compatible' : 'incompatible', 'rule' => $rule, 'message' => $lv <= $rv ? "{$rule} is compatible." : "{$left} requires {$lv}mm but clearance is {$rv}mm."];
        }
    }
}
