# Inventory locations

[Documentation index](../README.md)

Purpose: shelves, racks and bins inside warehouses at /modules/warehouse-bins. Public labels say Inventory Locations; API/storage use warehouse_bins and bin_id.

## Workflow and protection

Select an active warehouse; enter name, optional zone/rack/shelf/bin and status. BIN codes are generated. A saved location's warehouse is immutable: transfer stock rather than re-parenting it.

Each warehouse has protected Unassigned. It cannot be edited/deleted through CRUD. Used locations cannot be deleted. The table's warehouse filter is server-side across pages.

## API and data

/warehouse-bins provides generic CRUD and warehouse/status filters under products.view/create/update; delete also needs records.delete. GET /products/{id}/inventory-locations supplies product-specific availability choices.

Quantity balances use inventory_location_stock; serialized stock uses inventory_units.bin_id. Sales, receipts, repairs, movements and returns retain location references. Legacy requests may fall back to Unassigned or a unit's existing bin.

Sources: [service](../../backend/app/Services/InventoryLocationService.php), [picker](../../frontend/src/features/resources/InventoryLocationPicker.tsx), [query utilities](../../frontend/src/features/resources/inventory-location-queries.ts).

Never update only one balance table; shared inventory services keep child and warehouse balances aligned.

