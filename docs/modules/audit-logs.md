# Audit logs

[Documentation index](../README.md)

Purpose: operational traceability at /modules/audit-logs.

AuditService explicitly records action, entity, before/after and actor/request context where supplied. Controllers/services call it; it is not an automatic observer for every SQL statement.

GET /audit-logs requires users.manage. No create/update/delete API exists. Lists show readable actor/entity context. User administration snapshots omit password fields.

Data: audit_logs with user/entity references; history can outlive related records.

Sources: [AuditService](../../backend/app/Services/AuditService.php), [generic controller](../../backend/app/Http/Controllers/Api/V1/DomainResourceController.php).

Review sensitive snapshots and transaction boundaries. Some generic create/update audit writes occur after service operations; do not claim universal all-or-nothing audit coverage or tamper-proof archival.

