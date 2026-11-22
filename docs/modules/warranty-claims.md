# Warranty claims

[Documentation index](../README.md)

Purpose: record issues/resolution against warranty coverage.

GET list/detail, POST and PUT /warranty-claims accept warranty_id, issue, optional resolution/repair link and status. WCL numbers are generated. Permissions: products.view/create/update.

No delete route or dedicated frontend resource page exists. Status accepts a string; the generic service has no guarded claim state machine or automatic eligibility approval.

Data: warranty_claims -> warranty and optional repair. A claim prevents deletion of its parent coverage.

Sources: [validation](../../backend/app/Http/Requests/DomainResourceRequest.php), [resource service](../../backend/app/Services/DomainResourceService.php), [model](../../backend/app/Models/WarrantyClaim.php).

Recording a claim does not automatically refund, replace stock, contact vendors or approve coverage.

