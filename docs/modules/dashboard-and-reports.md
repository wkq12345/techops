# Dashboard and reports

[Documentation index](../README.md)

Purpose: operational visibility at /dashboard and /modules/reports.

GET /reports/dashboard requires reports.view. ReportService aggregates completed-payment revenue, order counts, quantity-stock cost value, available serialized counts, low-stock lines, repair totals/active/revenue and purchasing spend/outstanding counts.

These are status-filtered operational aggregates, not a general accounting ledger. Quantity valuation and serialized-unit counts are distinct measures; inspect filters before interpreting finance totals.

The frontend open-work queue combines loaded sales/repair/purchase records. Its loaded scope need not equal full-database totals. Stock availability also has loaded scope.

Sources: [ReportService](../../backend/app/Services/ReportService.php), [DashboardPage](../../frontend/src/features/dashboard/DashboardPage.tsx), [ResourcePage](../../frontend/src/features/resources/ResourcePage.tsx).

Summary caching defaults to 30 seconds. No WebSocket live push or arbitrary report-builder/export endpoints are declared.

