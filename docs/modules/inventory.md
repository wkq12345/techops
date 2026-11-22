# Inventory balances and operations

[Documentation index](../README.md)

Purpose: review on-hand/reserved/available balances at /modules/inventory and perform stock adjustments/transfers.

## Workflows

Adjustment selects a quantity-tracked product, warehouse/location, signed change and reason. New stock cannot fall below reservations.

Transfer selects a quantity-tracked product, distinct source/destination locations and positive quantity. Same-warehouse transfers move child balances only; cross-warehouse transfers also update totals. Reserved stock cannot be transferred.

Sales reserves/consumes, purchasing receives, repairs consume and returns restore by disposition. Shared internal stock methods rely on the calling transaction where they do not open one themselves.

## API and invariants

GET /inventory and /inventory/replenishment-suggestions require inventory.view. POST /stock-adjustments requires inventory.adjust; /stock-transfers requires inventory.transfer.

Quantity availability = quantity - reserved_quantity. Serialized products use unit statuses, not duplicated quantity balances. Current adjustment/transfer forms are not a general serialized-unit editor.

The inventory list queries child quantity-balance rows; it is not a consolidated
list of every serialized device. Use Serialized Units for individual serial/IMEI
stock and product-specific location choices for available-unit counts.

Table search/dropdown filters may apply to the loaded page only. Review concurrency, insufficient stock and aggregate/child consistency before changing logic.

Sources: [InventoryService](../../backend/app/Services/InventoryService.php), [controller](../../backend/app/Http/Controllers/Api/V1/InventoryController.php), [form](../../frontend/src/features/resources/InventoryActionForm.tsx).

