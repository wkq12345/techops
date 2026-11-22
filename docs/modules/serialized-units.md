# Serialized units

[Documentation index](../README.md)

Purpose: track individual serial/IMEI items at /modules/serialized-units. One unit is one physical device/item, not a product definition.

Receiving captures a real identifier per whole unit and creates available rows. Sales reserves a selected unit then marks it sold. Repair consumption marks it repair. Returns update its location/status by disposition.

Choices are filtered by product, warehouse, bin and availability. A serialized sales line must have quantity 1. Business-code generation does not fabricate serial numbers or IMEIs.

GET /inventory-units provides list/detail under products.view, with product_id, warehouse_id, bin_id and status filters. No generic create/update/delete route exists. Quantity stock adjustment/transfer is not serialized-unit CRUD.

Data: inventory_units -> product/warehouse/bin, referenced by business lines and movement history.

Sources: [InventoryService](../../backend/app/Services/InventoryService.php), [generic controller](../../backend/app/Http/Controllers/Api/V1/DomainResourceController.php), [sales form](../../frontend/src/features/resources/SalesOrderCreateForm.tsx).

