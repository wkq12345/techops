# API contracts and endpoint coverage

[Documentation index](../README.md)

Source of truth: [routes/api.php](../../backend/routes/api.php). Paths below are relative to /api/v1. /sanctum/csrf-cookie and /up are outside that prefix.

## Authentication and responses

Request CSRF cookie before session-authentication writes. Send cookies, XSRF header and Accept: application/json. Stateful API tests need the expected Origin. Protected endpoints use auth:sanctum and route Gates.

Common responses use data and optional message. List endpoints return Laravel paginator structures. HTTP 422 includes message/errors; distinguish 401 unauthenticated from 403 forbidden. Check specific controllers before assuming one universal envelope.

## Dedicated routes

| Family | Operations | Permission |
| --- | --- | --- |
| auth | POST login/forgot-password/reset-password; GET user; POST logout; PUT password | Guest or session as declared |
| users | List/detail/create/update/delete | users.manage |
| inventory | List/replenishment-suggestions | inventory.view |
| products/{id}/inventory-locations | GET | products.view |
| stock-adjustments / stock-transfers | POST | inventory.adjust / inventory.transfer |
| sales-orders | List/detail/create; POST complete; DELETE | sales.create; complete sales.approve; delete records.delete |
| repairs | List/detail/intake-lookup/create; POST status/parts | repairs.view / repairs.update |
| purchase-orders | List/detail/create; POST approve/receive | purchases.create; approval purchases.approve |
| pc-builds | List/detail/create/update/delete; POST duplicate/accept/convert/validate | sales.create; delete also records.delete |
| reports/dashboard | GET | reports.view |
| sales-returns | List/create | sales.create / sales.approve |
| audit-logs | List | users.manage |
| notifications | List; POST {id}/read | Session |

## Generic routes

Read/create/update use products.view/create/update. Delete also requires records.delete.

| Resources | List | Detail | Create | Update | Delete |
| --- | --- | --- | --- | --- | --- |
| customers, suppliers, brands, categories, attributes, products, warehouses, warehouse-bins, warranties | Yes | Yes | Yes | PUT | Yes |
| warranty-claims | Yes | Yes | Yes | PUT | No |
| inventory-units, quotations, invoices, supplier-returns | Yes | Yes | No | No | No |
| stock-movements, payments, purchase-requests, goods-receipts | Yes | No | No | No | No |

Sales-return generic detail also exists. An API resource need not have a dedicated UI page. No role CRUD route is declared.

## Pagination, sorting and search

[TablePagination](../../backend/app/Support/TablePagination.php) uses numbered pagination when sort_by is supplied; otherwise it preserves cursor pagination for selectors. Page size is clamped to 1-100; controller defaults vary, frontend tables request 30. Sort keys/directions are validated, never raw SQL.

Example: GET /api/v1/brands?search=Samsung&sort_by=name&sort_direction=asc&page=1&per_page=30.

Resource-specific filters vary. Preserve filter context when following cursor pages. Action columns are not sortable. Add backend query/allowlist support together with new frontend sortable columns.

## Representative write payloads

Sales creation below uses example IDs only. Resolve actual records through the
selectors; do not send generated order numbers, product prices or totals.

```json
{
  "customer_id": 1,
  "tax_rate": 0.06,
  "items": [
    { "product_id": 10, "warehouse_id": 2, "bin_id": 5, "quantity": 1 }
  ]
}
```

A serial/IMEI line additionally needs inventory_unit_id. Customer can be omitted
for walk-in. Warehouse/bin requirements differ for non-stock services.

Purchase creation accepts supplier_id, warehouse_id, optional expected_at/notes
and items with product_id, quantity and unit_cost. Receiving submits
purchase_order_item_id, quantity, optional bin_id and serials per item through the
PO receive route, not directly through /goods-receipts. Consult the relevant
Form Request for complete rules before integrating another client.

