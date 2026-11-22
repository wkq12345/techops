<?php

return [
    // Independent of CACHE_STORE: sessions, queues and throttling keep their stores.
    'store' => env('OPERATIONS_CACHE_STORE', 'redis'),
    'dashboard_ttl' => (int) env('OPERATIONS_DASHBOARD_TTL', 30),
    'catalog_ttl' => (int) env('OPERATIONS_CATALOG_TTL', 300),
];
