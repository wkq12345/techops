# Sales orders

[Documentation index](../README.md)

Purpose: reserve stock and complete sales at /modules/sales-orders.

## Workflow

1. Select a customer or walk-in.
2. Each line selects category, product, warehouse, child location and quantity; serialized lines also select a unit. Non-stock services need no physical location.
3. Save: backend reads selling prices, calculates totals and creates a confirmed order with reservations.
4. Complete: consume stock, record full payment, issue a paid invoice and eligible warranties in one transaction.

The frontend converts displayed tax percentage into the fractional tax_rate expected by the service. Client totals/prices are not authoritative. Repeated lines must collectively fit available stock.

## API and protection

GET list/detail and POST /sales-orders require sales.create. POST /{id}/complete requires sales.approve. DELETE requires records.delete.

Only confirmed/processing orders complete. Only uncompleted draft/confirmed/processing orders without invoices/returns can be deleted, releasing reservations. Completed rows do not show delete. There is no general order update route.

Data: sales_orders -> optional customer; items snapshot product/location/unit and cost/price. Lists expose customer_name.

Each line stores its own warehouse and bin. The order header stores a warehouse
when the lines resolve to exactly one warehouse. Orders spanning multiple
warehouses leave the header warehouse empty. Older clients can still supply a
header warehouse as a fallback for lines that omit it.

Sources: [SalesService](../../backend/app/Services/SalesService.php), [controller](../../backend/app/Http/Controllers/Api/V1/SalesOrderController.php), [form](../../frontend/src/features/resources/SalesOrderCreateForm.tsx).

This is not a partial-payment ledger or external gateway integration.

