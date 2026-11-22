# Redis operations cache

[Documentation index](../README.md)

Purpose: reduce repeated reads without making Redis business storage.

Defaults: dashboard 30 seconds, category/brand lists 300 seconds. Full request URL separates search/sort/page variants. Scope includes database/environment identity.

Catalog observer invalidates groups after committed Brand/Category/Product mutations. Products invalidate category/brand counts. Versioned group keys avoid broad Redis flushes. Dashboard freshness relies on TTL, not every workflow invalidating it.

Failures fall back to PostgreSQL with bounded warnings; failed invalidation may leave entries until TTL. Reads inside transactions bypass cache. Direct query-builder updates bypass model observers.

Configuration: OPERATIONS_CACHE_STORE, OPERATIONS_DASHBOARD_TTL, OPERATIONS_CATALOG_TTL and REDIS_*. Composer requires native PhpRedis 6.3+; Predis is not an application dependency. Supplied learning configuration keeps sessions, queues and default cache database-backed.

Sources: [OperationsCache](../../backend/app/Services/OperationsCache.php), [observer](../../backend/app/Observers/CatalogCacheObserver.php), [config](../../backend/config/operations-cache.php).

Compose/Kubernetes Redis is cache-only, without persistent business data. Do not use flush-all on shared Redis as a troubleshooting shortcut.

