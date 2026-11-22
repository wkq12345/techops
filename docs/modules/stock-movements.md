# Stock movements

[Documentation index](../README.md)

Purpose: read-only stock ledger at /modules/stock-movements.

Stock-changing services append movement type, signed quantity, product, warehouse/bin, optional unit, reference and actor/time. Types include purchase_receive, sale, repair_use, adjustment_in/out, transfer_in/out and customer_return.

Reservations are distinct from physical movements: reserve/release operations change balances or unit status without necessarily adding ledger rows.

GET /stock-movements requires products.view. No create/update/delete API is exposed; use the originating workflow.

Sources: [InventoryService](../../backend/app/Services/InventoryService.php), [resource service](../../backend/app/Services/DomainResourceService.php).

For returns, read disposition: positive movement quantity does not always increase sellable balance. Do not edit history to hide discrepancies.

