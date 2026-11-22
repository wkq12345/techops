# Warehouses

[Documentation index](../README.md)

Purpose: stock-holding sites such as shops/stores at /modules/warehouses. A warehouse is not itself a rack/bin.

Create/edit name, address and status. WH codes are automatic. Creation also establishes a protected Unassigned child location. Manage shelves/racks separately through [inventory locations](inventory-locations.md).

/warehouses provides generic CRUD under products.view/create/update; delete also needs records.delete. Used locations, stock and business references protect warehouses from deletion; the service specially handles system Unassigned.

Data: warehouses -> warehouse_bins; balances, units, orders and receipts retain warehouse context. A PO has one receiving warehouse; a sale can choose a different warehouse per line.

Sources: [resource service](../../backend/app/Services/DomainResourceService.php), [location service](../../backend/app/Services/InventoryLocationService.php).

Use transfer operations to move stock, not direct foreign-key changes.

