# Architecture overview

[Documentation index](../README.md)

TechOps is a monorepo: React/TypeScript browser application, Laravel REST API, PostgreSQL business database and optional Redis operations cache. The browser never connects directly to PostgreSQL/Redis.

```text
React -> Axios (cookies + CSRF) -> Laravel routes / middleware
  -> Gates / Form Requests -> Controllers -> Services -> Eloquent / PostgreSQL
                                              |-> Audit / database notifications
                                              |-> Redis operations cache
Scheduler -> ops:send-reminders -> database notifications / warranty expiry
```

## Ownership

Laravel owns authorization, validated inputs, stock changes, persisted codes and sales pricing. React owns navigation, interaction, forms and display formatting. TanStack Query manages browser server-state caching; it is separate from server-side Redis.

## Repository map

| Path | Responsibility |
| --- | --- |
| frontend/src/features/auth | Authentication, account and session boundaries |
| frontend/src/features/dashboard | Operational overview |
| frontend/src/features/resources | Configured list pages and workflow forms |
| frontend/src/components | Layout, theme and reusable UI |
| backend/routes/api.php | Endpoint declarations and permissions |
| backend/app/Http | Controllers, requests and response resources |
| backend/app/Services | Domain workflows and shared services |
| backend/app/Models | Persisted entities/relationships |
| backend/database | Migration history and seeders |
| deploy/k8s | Isolated local learning deployment |

## Boundaries and integrity

Windows, Compose and Kubernetes are alternative runtimes with separate database identities, not one shared database. Host clients use published ports; container clients use service DNS.

Sales, purchasing, repairs and returns share InventoryService. Quantity stock has warehouse totals plus child-location balances. Serialized stock uses individual unit rows; do not double-count it as quantity balances.

Major workflows use transactions/locks, but do not assume every generic operation and audit write is universally atomic. Catalog cache invalidation runs after commit; dashboard freshness uses a short TTL.

The current backend container uses Artisan's development server. Production runtime, TLS, hardening and backup operations require a separate deployment plan.

