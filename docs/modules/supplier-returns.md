# Supplier returns

[Documentation index](../README.md)

Purpose: represent supplier-return history linked to suppliers/products.

Current support is the SupplierReturn model/schema and GET /supplier-returns list/detail under products.view. No dedicated page or create/update/delete/dispatch/credit-note API is declared.

Model/table existence does not establish outbound inventory movement or vendor reimbursement. Existing references participate in supplier/product deletion protection.

Sources: [model](../../backend/app/Models/SupplierReturn.php), [resource service](../../backend/app/Services/DomainResourceService.php), [routes](../../backend/routes/api.php).

Future work must explicitly define units/quantities, stock deduction, approval, supplier credits and audit requirements.

