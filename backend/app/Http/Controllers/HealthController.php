<?php

namespace App\Http\Controllers;

use App\Services\HealthDependencies;
use Illuminate\Http\JsonResponse;
use Throwable;

final class HealthController
{
    public function live(): JsonResponse
    {
        return new JsonResponse(['status' => 'ok'], headers: ['Cache-Control' => 'no-store']);
    }

    public function ready(HealthDependencies $dependencies): JsonResponse
    {
        $checks = [
            'postgres' => $this->check($dependencies->postgres(...)),
            'redis' => $this->check($dependencies->redis(...)),
        ];
        $ready = ! in_array('unavailable', $checks, true);

        return new JsonResponse(
            ['status' => $ready ? 'ok' : 'unavailable', 'checks' => $checks],
            $ready ? 200 : 503,
            ['Cache-Control' => 'no-store'],
        );
    }

    private function check(callable $probe): string
    {
        try {
            return $probe() ? 'ok' : 'unavailable';
        } catch (Throwable) {
            return 'unavailable';
        }
    }
}

