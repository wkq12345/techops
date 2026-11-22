# Customer returns

[Documentation index](../README.md)

Purpose: record completed-sale returns at /modules/returns.

Choose a completed order, original lines, receiving warehouse/location, quantity, reason, disposition and refund amount. UI can default to sold-location context; the return request chooses receiving context.

ReturnService locks the order/lines and limits cumulative returns to original sold quantity. It records return/items and restores stock by disposition transactionally. Quantity stock becomes sellable only with available disposition; serialized returns update unit status/location.

GET /sales-returns requires sales.create; POST requires sales.approve; generic detail requires products.view. No edit/delete route exists.

Data: sales_returns -> order; sales_return_items -> original line/product/unit/bin. refund_amount is recorded, not an automatically executed external refund/payment reversal.

Sources: [ReturnService](../../backend/app/Services/ReturnService.php), [request](../../backend/app/Http/Requests/SalesReturnRequest.php), [form](../../frontend/src/features/resources/ReturnCreateForm.tsx).

Review repeated returns, dispositions and receiving locations when changing behavior.

