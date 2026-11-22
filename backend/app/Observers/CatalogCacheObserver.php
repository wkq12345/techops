<?php

namespace App\Observers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Services\OperationsCache;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;
use Illuminate\Database\Eloquent\Model;

class CatalogCacheObserver implements ShouldHandleEventsAfterCommit
{
    public function __construct(private readonly OperationsCache $cache) {}

    public function saved(Model $model): void
    {
        $this->invalidate($model);
    }

    public function deleted(Model $model): void
    {
        $this->invalidate($model);
    }

    private function invalidate(Model $model): void
    {
        if ($model instanceof Brand || $model instanceof Product) {
            $this->cache->invalidate('brands');
        }
        if ($model instanceof Category || $model instanceof Product) {
            // Includes parent labels, subcategory counts and product counts.
            $this->cache->invalidate('categories');
        }
    }
}
