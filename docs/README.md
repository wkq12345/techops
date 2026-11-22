# TechOps documentation

Code-reviewed on 2026-11-21. These guides describe implementation, not a claim that every runtime/workflow has been tested live.

## Architecture and operations

- [Overview](architecture/overview.md)
- [Laravel backend and reusable PHP](architecture/backend.md)
- [React frontend and shared UI](architecture/frontend.md)
- [Database relationships and safety](architecture/database.md)
- [API contracts and endpoint coverage](architecture/api.md)
- [Development, deployment and troubleshooting](operations.md)

## Module guides

| Area | Guides |
| --- | --- |
| Access | [Authentication/account](modules/authentication.md), [Users/roles](modules/users-and-roles.md) |
| Overview | [Dashboard/reports](modules/dashboard-and-reports.md) |
| Catalog | [Products](modules/products.md), [Categories](modules/categories.md), [Brands](modules/brands.md), [Attributes/compatibility](modules/attributes-and-compatibility.md) |
| Contacts | [Customers](modules/customers.md), [Suppliers](modules/suppliers.md) |
| Stock | [Warehouses](modules/warehouses.md), [Locations](modules/inventory-locations.md), [Inventory](modules/inventory.md), [Serialized units](modules/serialized-units.md), [Movements](modules/stock-movements.md) |
| Sales | [Sales orders](modules/sales-orders.md), [Invoices/payments](modules/invoices-and-payments.md), [Quotations](modules/quotations.md) |
| Purchasing | [Purchase orders](modules/purchase-orders.md), [Goods receipts](modules/goods-receipts.md), [Purchase requests/replenishment](modules/purchase-requests.md) |
| Services | [Repairs](modules/repairs.md), [PC builds](modules/pc-builds.md) |
| After-sales | [Warranties](modules/warranties.md), [Claims](modules/warranty-claims.md), [Customer returns](modules/customer-returns.md), [Supplier returns](modules/supplier-returns.md) |
| Shared | [Audit](modules/audit-logs.md), [Notifications/scheduler](modules/notifications.md), [Caching](modules/caching.md), [Mail](modules/mail.md), [Generated codes](modules/generated-codes.md) |

## Existing references

[Root setup guide](../README.md), [UI design system](../frontend/DESIGN_SYSTEM.md), [Kubernetes learning guide](../deploy/k8s/README.md).

## Conventions and maintenance

API paths in module guides are relative to /api/v1 unless stated otherwise. Frontend module URLs generally use /modules/<module>. IDs remain internal relationship keys even when the UI displays names.

Routes determine exposed functionality. A model/table or generic service method alone does not establish a usable workflow; supporting/limited resources are marked explicitly.

Update the relevant guide alongside code changes: purpose, workflow, fields, permissions, relationships, invariants, limitations and source references. Update architecture/API guides for shared changes. Never include credentials or real customer data.

Use the [module template](MODULE_TEMPLATE.md) when introducing a new module.

