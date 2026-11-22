<?php

namespace App\Services;

use Closure;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class OperationsCache
{
    private bool $unavailable = false;

    public function remember(string $group, array $context, int $seconds, Closure $load): mixed
    {
        // Never publish uncommitted data or use cached data inside a transaction.
        if ($this->unavailable || $seconds < 1 || DB::connection()->transactionLevel() > 0) {
            return $load();
        }

        try {
            $store = $this->store();
            $versionKey = $this->versionKey($group);
            $version = $store->get($versionKey);
            if (! is_string($version)) {
                // A random version prevents evicted markers from reviving old results.
                $store->add($versionKey, (string) Str::uuid(), 604800);
                $version = $store->get($versionKey);
            }
            if (! is_string($version)) {
                throw new RuntimeException('Cache generation could not be initialized.');
            }
            $key = $versionKey.':'.$version.':'.hash('sha256', json_encode($context, JSON_THROW_ON_ERROR));
            $cached = $store->get($key);
            if ($cached !== null) {
                return $cached;
            }
        } catch (Throwable $exception) {
            $this->cacheFailed($exception);

            return $load();
        }

        // Database and application errors must propagate, not be retried as cache errors.
        $value = $load();
        try {
            $store->put($key, $value, $seconds);
        } catch (Throwable $exception) {
            $this->cacheFailed($exception);
        }

        return $value;
    }

    public function invalidate(string $group): void
    {
        try {
            // Readers already in flight can only populate the previous generation.
            $this->store()->put($this->versionKey($group), (string) Str::uuid(), 604800);
        } catch (Throwable $exception) {
            $this->cacheFailed($exception);
        }
    }

    private function store(): Repository
    {
        return Cache::store(config('operations-cache.store'));
    }

    private function versionKey(string $group): string
    {
        $connection = DB::connection();
        // Windows PostgreSQL and Docker PostgreSQL may share Redis but not data.
        $scope = hash('sha256', json_encode([
            config('app.env'), $connection->getName(),
            $connection->getConfig('driver'), $connection->getConfig('host'),
            $connection->getConfig('port'), $connection->getDatabaseName(),
        ], JSON_THROW_ON_ERROR));

        return 'operations:v1:'.$scope.':'.$group;
    }

    private function cacheFailed(Throwable $exception): void
    {
        if (! $this->unavailable) {
            Log::warning('Operations cache unavailable; reading directly from the database.', [
                'exception' => $exception::class,
            ]);
        }
        $this->unavailable = true;
    }
}
