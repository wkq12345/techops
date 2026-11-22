# Purchase orders

[Documentation index](../README.md)

Purpose: supplier ordering, approval and receiving at /modules/purchase-orders.

Create supplier, receiving warehouse, expected date, notes and product lines with quantities/unit costs. Backend calculates totals and starts pending_approval. Approval produces approved; partial/full receiving produces partially_received/received.

GET list/detail and POST /purchase-orders require purchases.create. POST /{id}/approve requires purchases.approve; /{id}/receive requires purchases.create. Only pending orders approve; only approved/ordered/partially_received orders receive. No update/delete route exists.

Data: purchase_orders -> supplier/warehouse; purchase_order_items store ordered/received quantities and cost. Lists show supplier context.

Sources: [PurchasingService](../../backend/app/Services/PurchasingService.php), [controller](../../backend/app/Http/Controllers/Api/V1/PurchaseOrderController.php), [form](../../frontend/src/features/resources/PurchaseOrderCreateForm.tsx).

Creation/approval does not increase stock. Receiving goes through [goods receipts](goods-receipts.md).

