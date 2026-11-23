# Generated business codes

[Documentation index](../README.md)

Purpose: stable server-owned references without manual entry.

| Resource | Field | Prefix |
| --- | --- | --- |
| Customers | customer_code | CUS |
| Suppliers | supplier_code | SUP |
| Products | sku | PRD |
| Warehouses | code | WH |
| Inventory locations | code | BIN |
| Warranties | number | WAR |
| Warranty claims | number | WCL |

Codes use a six-digit minimum numeric portion, e.g. CUS-000001. RecordCodeService locks a record_code_sequences row, starts beyond matching legacy codes and checks collisions. Allocation can roll back with record creation. Existing references remain unchanged.

Create forms hide generated code fields. Edit forms display the assigned code
as read-only. Both omit the code from submissions, and request validation
rejects manual values. IDs are distinct from code suffixes.

Orders, repairs, builds, receipts, invoices and returns retain separate timestamp/random document generators. Real serial/IMEI values are not generated.

Sources: [RecordCodeService](../../backend/app/Services/RecordCodeService.php), [migration](../../backend/database/migrations/2026_10_07_000001_create_record_code_sequences_table.php).

Never reset counters/drop the sequence table to reuse deleted numbers. Gaps are acceptable; references are not row counts.

