# Goods receipts

[Documentation index](../README.md)

Purpose: physical receiving against POs, with history at /modules/goods-receipts.

Choose remaining lines, quantities and destination locations within the PO warehouse. Serial/IMEI products require an identifier for every whole unit. Submit POST /purchase-orders/{id}/receive under purchases.create.

PurchasingService locks PO/lines, refuses excess receiving, creates receipt/items, adds stock/units and updates PO totals/status transactionally.

GET /goods-receipts lists history under products.view. There is no generic standalone receipt create/update/delete/detail route. The receiving workflow owns stock changes.

Data: goods_receipts, goods_receipt_items, PO lines, stock/units and movements. Receipt numbers are automatic.

Sources: [PurchasingService](../../backend/app/Services/PurchasingService.php), [request](../../backend/app/Http/Requests/GoodsReceiptRequest.php), [form](../../frontend/src/features/resources/GoodsReceiptForm.tsx).

Review partial/full/excess receiving, invalid bins and serial counts when changing behavior.

