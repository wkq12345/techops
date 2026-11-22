# Quotations

[Documentation index](../README.md)

Purpose: represent quotation headers/items in the data model.

Current scope is supporting infrastructure: models/tables exist, and GET /quotations list/detail requires products.view. No dedicated quotation page or create/update/delete/conversion API is declared.

Do not describe issuance, approval, expiry processing or sales conversion as completed functionality. PC-build estimates are a separate implemented workflow.

Data: quotations, quotation_items and customer/product relationships. Linked quotations participate in reference-safe deletion checks.

Sources: [Quotation](../../backend/app/Models/Quotation.php), [QuotationItem](../../backend/app/Models/QuotationItem.php), [routes](../../backend/routes/api.php).

Future implementation requires explicit validation, pricing snapshots, workflow rules, permissions, UI and tests.

