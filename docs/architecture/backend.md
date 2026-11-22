# Laravel backend and reusable PHP

[Documentation index](../README.md)

## Request lifecycle

[bootstrap/app.php](../../backend/bootstrap/app.php) enables stateful Sanctum, /up and the reminder schedule. [routes/api.php](../../backend/routes/api.php) selects controllers and authentication/Gates. Form Requests validate inputs; controllers invoke services and shape JSON; services coordinate models, transactions and domain rules.

## Services

| Service | Ownership |
| --- | --- |
| AuthService | Sign-in/out, password change/recovery |
| UserManagementService / UserRoleService | Accounts and Admin/Staff provisioning |
| DomainResourceService | Allowlisted master/support resources and reference-safe deletion |
| InventoryService / InventoryLocationService | Stock changes and child locations |
| SalesService | Reservations, completion, payments, invoices, warranties |
| PurchasingService | Purchase creation, approval, receiving |
| RepairService | Intake, transitions, parts |
| PcBuildService / CompatibilityService | Build editing, acceptance, conversion, checks |
| ReturnService | Customer return/disposition handling |
| ReportService / OperationsCache | Aggregates and bounded cache |
| AuditService / NotificationService | Traceability and in-app messages |
| RecordCodeService | Transactional code allocation |

Sources: [services](../../backend/app/Services), [requests](../../backend/app/Http/Requests), [models](../../backend/app/Models).

## Reusable code guidance

Use injected services for persistent business logic, model relationships/scopes for queries, Form Requests for validation, Gates for authorization and support classes for infrastructure utilities. [TablePagination](../../backend/app/Support/TablePagination.php) is an existing reusable support class.

Composer does not register an application-wide helpers file. Do not introduce global helpers for stock/order logic. Small pure stateless utilities may merit a namespaced class or narrowly named helper; React should keep display formatting on its side.

## Extension checklist

Extend the owning service; enforce backend permissions; validate inputs; preserve locks/transaction boundaries; expose readable related context; add sort allowlist/query support when needed; update frontend and docs together.

Model observers handle catalog invalidation after commit. Direct query-builder writes bypass those events. Do not silently return success after an exception.

API validation errors use HTTP 422 with message/errors. Keep authentication failures distinct from forbidden actions. Never log credentials or complete private environment files. Never truncate/drop tables or perform destructive rollback without permission.

