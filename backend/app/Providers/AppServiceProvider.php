<?php

namespace App\Providers;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Observers\CatalogCacheObserver;
use App\Services\OperationsCache;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(OperationsCache::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        foreach ([Brand::class, Category::class, Product::class] as $model) {
            $model::observe(CatalogCacheObserver::class);
        }

        Password::defaults(fn () => Password::min(12));
        Gate::before(function ($user, string $ability): ?bool {
            if (in_array($ability, ['records.delete', 'users.manage'], true)) {
                return $user->isAdministrator();
            }
            if ($user->isAdministrator()) {
                return true;
            }

            return $user->hasPermissionTo($ability) ? true : null;
        });

        ResetPassword::createUrlUsing(fn ($user, string $token): string => sprintf(
            '%s/reset-password?token=%s&email=%s',
            rtrim((string) config('app.frontend_url'), '/'),
            urlencode($token),
            urlencode($user->getEmailForPasswordReset()),
        ));
    }
}
