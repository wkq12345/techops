# Suppliers

[Documentation index](../README.md)

Purpose: purchasing contacts at /modules/suppliers.

Company name is required; contact person, email, phone, address and notes are optional. Status is active/inactive. supplier_code is automatic, for example SUP-000001.

/suppliers supports generic CRUD under products.view/create/update; deletion also requires records.delete. Purchase-order/supplier-return history blocks deletion.

Data: suppliers; purchase_orders.supplier_id; supplier_returns.supplier_id. Purchase lists display company context while relationships remain IDs.

Sources: [validation](../../backend/app/Http/Requests/DomainResourceRequest.php), [resource service](../../backend/app/Services/DomainResourceService.php), [purchase form](../../frontend/src/features/resources/PurchaseOrderCreateForm.tsx).

Creating a supplier does not order or receive stock.

