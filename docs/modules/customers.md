# Customers

[Documentation index](../README.md)

Purpose: customer contacts at /modules/customers and readable identity across orders, repairs, builds and warranties.

Name is required; email, phone, address and notes are optional. customer_code is automatic, for example CUS-000001. Forms omit manual codes.

/customers supports generic CRUD under products.view/create/update; delete also requires records.delete. References from quotations, orders, repairs, builds or warranties block deletion.

Sales can be walk-in; repairs require a customer. Requests/storage retain customer_id, while lists should show names. Diagnose missing names in backend queries/relationships rather than replacing them with IDs.

Sources: [resource service](../../backend/app/Services/DomainResourceService.php), [validation](../../backend/app/Http/Requests/DomainResourceRequest.php), [forms](../../frontend/src/features/resources/resource-forms.ts).

