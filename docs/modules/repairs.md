# Repairs

[Documentation index](../README.md)

Purpose: device intake through collection at /modules/repairs.

Create a customer job with device/problem details and optional technician/estimate. Intake lookup finds existing context. Adding parts chooses stock/location and reserves/consumes through InventoryService.

## Transitions

| Current | Allowed next |
| --- | --- |
| received | diagnosing, cancelled |
| diagnosing | awaiting_approval, cancelled |
| awaiting_approval | awaiting_parts, repairing, cancelled |
| awaiting_parts | repairing, cancelled |
| repairing | testing, cancelled |
| testing | ready_for_collection, repairing |
| ready_for_collection | completed |
| completed / cancelled | None |

Transitions append history/audit. Ready-for-collection sends in-app messages to relevant users, not automatic customer email.

GET /repairs list/detail/intake-lookup requires repairs.view. POST create/status/parts requires repairs.update. No general update/delete route exists.

Data: repair_jobs -> customer/technician; repair_devices, repair_parts and repair_status_history. Diagnosis/note models exist without dedicated routes.

Sources: [RepairService](../../backend/app/Services/RepairService.php), [controller](../../backend/app/Http/Controllers/Api/V1/RepairController.php), [intake form](../../frontend/src/features/resources/RepairCreateForm.tsx).

Status changes do not automatically invoice/refund. Cancelling a job does not imply previously consumed parts are restored.

