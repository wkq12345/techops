# Database architecture

[Documentation index](../README.md)

PostgreSQL is authoritative business storage. [Migrations](../../backend/database/migrations) define schema history. IDs are relationship keys, separate from business codes/document numbers.

| Domain | Principal relationships |
| --- | --- |
| Identity | users -> user_roles -> roles -> role_permissions -> permissions |
| Catalog | categories.parent_id -> categories; products -> category/brand; product_attribute_values -> product/attribute |
| Locations | warehouses -> warehouse_bins |
| Quantity stock | inventory_stock by product/warehouse; inventory_location_stock by product/bin |
| Serialized stock | inventory_units -> product/warehouse/bin |
| Sales | sales_orders -> customer; items -> order/product/warehouse/bin/optional unit; invoices/payments -> order |
| Purchasing | purchase_orders -> supplier/warehouse; PO items -> product; receipts -> PO; receipt items -> PO line/bin |
| Repairs | repair_jobs -> customer/technician; devices/parts/history -> job |
| Builds | pc_builds -> customer/optional sales order; items/requirements -> build |
| After-sales | warranties -> customer/product/unit/reference; claims -> warranty/optional repair; sales returns -> order/original lines |
| Operations | audit_logs, notifications, operational_reminders, record_code_sequences, sessions, cache, jobs |

Some references are polymorphic type/ID pairs; do not assume every arbitrary reference has a database foreign-key guarantee.

## Stock rules

Quantity availability = on-hand - reserved. InventoryService updates warehouse and child balances together. Same-warehouse transfers move child stock without changing the aggregate.

Serialized stock uses unit statuses, not duplicated quantity rows. One serialized sales line reserves exactly one unit. Non-stock services bypass physical reservations.

Each warehouse has protected Unassigned fallback location. Relocating stock requires a transfer, not re-parenting a bin.

## Migrations and safety

Code sequences and inventory-location migrations are additive, including legacy backfills. Seeders establish roles/admin/demo data; they are not a general live-data synchronization mechanism. Kubernetes uses an isolated initial-only bootstrap.

Users use soft deletion; not every entity does. Reference-safe deletion varies by resource.

Never truncate/drop tables, reset counters, run migrate:fresh, remove persistent volumes or perform destructive rollback without permission. Confirm host/port/database/runtime before schema work and back up first. Applying migrations is not an incidental documentation check.

