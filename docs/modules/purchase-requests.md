# Purchase requests and replenishment

[Documentation index](../README.md)

Purpose: identify replenishment needs and support review/drafting purchasing input.

GET /inventory/replenishment-suggestions requires inventory.view. In the frontend,
review included products/quantities and select a supplier/receiving warehouse.
ReplenishmentDraftForm submits POST /purchase-orders, creating a PO in
pending_approval under purchases.create. Despite the draft label, it creates a
purchase order, not a purchase_requests record or supplier dispatch.

Suggestions compare available quantity (or available serialized-unit count) across
locations with the product reorder level, for at most 500 active tracked products
with a positive reorder level. They are not a per-warehouse demand forecast.

PurchaseRequest/PurchaseRequestItem models and tables exist. GET /purchase-requests provides a supporting list under products.view. No dedicated page or create/update/delete/detail/approval routes are declared for purchase requests.

Sources: [InventoryController](../../backend/app/Http/Controllers/Api/V1/InventoryController.php), [draft form](../../frontend/src/features/resources/ReplenishmentDraftForm.tsx), [model](../../backend/app/Models/PurchaseRequest.php).

Suggestions depend on recorded balances/reorder rules. Staff must review supplier, quantity and cost; this module does not automatically buy stock or contact vendors.

