# Brands

[Documentation index](../README.md)

Purpose: maintain manufacturer identities at /modules/brands.

Create/edit a unique name and active/inactive status. The backend generates an internal slug; no manual brand code is needed. The table shows product counts.

/brands supports generic CRUD under products.view/create/update; delete also requires records.delete. Brands linked to products cannot be deleted; reassign products or mark inactive.

Data: brands, products.brand_id. Brand mutations invalidate brand lists after commit; product mutations also invalidate them to keep counts current.

Sources: [validation](../../backend/app/Http/Requests/DomainResourceRequest.php), [resource service](../../backend/app/Services/DomainResourceService.php), [cache observer](../../backend/app/Observers/CatalogCacheObserver.php).

Check duplicate-name validation, linked-product protection and cache invalidation when extending this module.

