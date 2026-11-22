# Development and operations

[Documentation index](README.md)

This guide does not assert that any runtime is currently online.

## Runtime choices

| Backend runtime / database | Database address from backend | Browser access |
| --- | --- | --- |
| Windows / Windows PostgreSQL | Usually 127.0.0.1:5432; confirm configuration | Vite / Artisan |
| Windows / Compose PostgreSQL | 127.0.0.1:5433 | Vite / Artisan |
| Compose | postgres:5432 | Frontend 5173, backend 8000 |
| Kubernetes learning | postgres:5432 in techops-learning | 127.0.0.1:8080 through port-forward |

These can be distinct databases. pgAdmin saves connections; registering a server does not install/start PostgreSQL. PostgreSQL ports are not HTTP pages.

## Windows development

From the repository root, in separate terminals:

```powershell
Set-Location backend
composer install
php --ri redis
php artisan config:clear
php artisan serve
```

```powershell
Set-Location frontend
npm ci
npm run dev
```

Use the frontend's lockfile/package-manager convention consistently. Missing Vite modules usually mean missing/broken installed dependencies; do not copy node_modules between relocated folders.

Preserve existing .env and APP_KEY. Copy example configuration only for a new setup. Confirm PDO PostgreSQL and native PhpRedis match the active CLI PHP. Apply migrations/seed only to an intentionally selected database with authorization; see [root setup](../README.md).

## Deployment

[Compose](../docker-compose.yml) defines PostgreSQL, Redis, backend, scheduler and frontend. backend/.env credentials must match the intended database. Container host overrides do not modify Windows PostgreSQL.

The [Kubernetes guide](../deploy/k8s/README.md) owns prerequisites, staged bootstrap, secrets, readiness, verification, troubleshooting and stopping. Use its deployment helper, not raw placeholder manifests. Existing files do not prove a cluster is enabled/deployed.

Both container options keep the current development web runtime. Production runtime/TLS/hardening/backups need a separate plan.

## Configuration and security

Match APP_URL, FRONTEND_URL, SANCTUM_STATEFUL_DOMAINS and frontend API base to the browser hostname; avoid mixing localhost with 127.0.0.1. Secure cookies require appropriate HTTPS configuration.

Keep database-backed sessions/queues/default cache distinct from Redis operations caching. Never commit .env, Gmail credentials, APP_KEY or deploy/k8s/.local. VITE_* values are public build inputs.

## Safe verification

Use migration status, schedule:list, logs and configuration inspection before mutations. /up proves application health, not every dependency. Redis ping proves connectivity, not invalidation.

[phpunit.xml](../backend/phpunit.xml) configures SQLite :memory:, array cache/session/mail and sync queues. Before database tests, confirm no cached config/external override redirects tests to real data. Refresh-database traits must never target business storage.

Frontend checks: npm test and npm run build. Tests/builds do not replace user workflow acceptance. No application tests or database commands were run for this documentation update.

Kubernetes Test-Local.ps1 optionally restarts/redeploys its isolated workload; those flags intentionally change learning-environment state. Consult its guide first.

## Troubleshooting

| Symptom | First check |
| --- | --- |
| Generic login failure | Network response and Laravel log; distinguish 401/419/500/connection failure |
| PostgreSQL timeout | Running server/container, port binding, firewall |
| Password authentication failed | Correct role/password on that actual server |
| CSRF/session failure | Origin, hostname, cookies, stateful domain and API base |
| Stale catalog | TTL, observer/event path and Redis environment; avoid global flush |
| Missing customer name | Backend join/eager-load and response field, not raw-ID fallback |
| Container changes missing | Correct image rebuild/recreation and frontend build-time URL |

Redact customer data and reset tokens from logs. Never truncate/drop/reset databases or delete volumes as a troubleshooting shortcut.

