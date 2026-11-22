# Invoices and payments

[Documentation index](../README.md)

Purpose: retain completed-sales evidence and print invoices at /modules/invoices.

SalesService::complete creates a completed payment for the entire saved total and a paid invoice alongside fulfilment. Payment stores method/reference; invoice stores automatic number, issue date and total. Recording a payment is not external settlement verification.

GET /invoices provides list/detail under products.view; detail loads order/customer/items/products for printing. GET /payments lists payments. Neither resource has generic create/update/delete routes.

Frontend invoice actions use browser printing, not server-generated PDFs. List/detail context should show names/order references rather than foreign-key IDs.

Sources: [SalesService](../../backend/app/Services/SalesService.php), [resource service](../../backend/app/Services/DomainResourceService.php), [RecordActions](../../frontend/src/features/resources/RecordActions.tsx).

Do not delete completed financial history to rewrite a sale. Return refund_amount is recorded data, not proof of an executed refund.

