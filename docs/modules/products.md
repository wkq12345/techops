# Products

[Documentation index](../README.md)

Purpose: manage identity, pricing and tracking rules at /modules/products.

## Workflow

Create/edit name, optional category/brand, product type, tracking type, nonnegative cost/selling prices, warranty months, reorder level, description and status. SKU is generated and cannot be supplied manually.

Product warranty months can be zero for no automatic coverage. The editor
loads the saved product duration. Individual warranty records use their own
coverage dates and require at least one month.

Product types: physical, serialized, service. Tracking types: none, quantity, serial, imei. These are separate fields; do not assume validation prevents every unsuitable combination or safely converts existing stock between tracking modes.

Category-first selectors include descendants. Product API search is server-side; dropdown filters on the product table may affect loaded rows only.

## API, data and safeguards

/products provides generic CRUD under products.view/create/update. Delete additionally requires records.delete and refuses linked stock/business history; mark inactive instead.

Data: products -> category/brand; product_attribute_values store compatibility characteristics. Sales reads saved selling prices, receiving uses purchase-line cost. Product mutations invalidate cached category/brand counts after commit.

Sources: [validation](../../backend/app/Http/Requests/DomainResourceRequest.php), [resource service](../../backend/app/Services/DomainResourceService.php), [forms](../../frontend/src/features/resources/resource-forms.ts), [picker](../../frontend/src/features/resources/CategoryProductPicker.tsx).

