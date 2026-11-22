# React frontend and shared UI

[Documentation index](../README.md)

## Structure

- [App.tsx](../../frontend/src/App.tsx): auth routes, protected layout, dashboard/account and /modules/:resource.
- [navigation-config.ts](../../frontend/src/components/layout/navigation-config.ts): grouped sidebar and permission visibility.
- [resource-config.ts](../../frontend/src/features/resources/resource-config.ts): endpoint, columns, descriptions and delete support.
- [ResourcePage](../../frontend/src/features/resources/ResourcePage.tsx): shared record workspace.
- [resource-forms.ts](../../frontend/src/features/resources/resource-forms.ts): declarative master-data forms.
- Specialized forms handle sales, purchasing, receipts, repairs, builds, returns and stock operations.
- [api-client.ts](../../frontend/src/services/api-client.ts): Axios credentials/XSRF behavior.

## State and requests

TanStack Query owns server state; forms own drafts. Mutations refresh affected queries. Auth session boundaries clear operational query data at logout/session expiry.

VITE_API_URL is a public build-time input, defaulting to http://localhost:8000. Calls include /api/v1 paths. Kubernetes builds a relative base and proxies requests through Nginx. Changing a compiled API base requires rebuilding.

## Design system

Use Button variants, Field required labels, PageHeader, DataTable, StatusBadge, RowActionButton and Modal. Theme tokens live in styles/theme.css; structure in styles/workspace.css. See [design system](../../frontend/DESIGN_SYSTEM.md).

Forms use pop-up modals with focus management and pending-mutation protection. Failed saves retain drafts. Edit/delete actions use accessible icons and state/permission-based visibility; Laravel remains the security boundary.

## Tables and selectors

Tables request numbered pages, generally 30 rows, and allowlisted server sorting. ID is the first left-aligned column; related fields display names/details. Action headings and groups share alignment.

Selectors use cursor pagination and must load additional pages. Category filters include descendants. Inventory/product dropdown filters may apply only to loaded rows; the inventory-location warehouse filter is server-side.

For a new module, add resource/navigation configuration, form/workflow handling, API support, query refresh, tests and documentation. Prefer a specialized form for complex workflows over growing generic conditionals.

