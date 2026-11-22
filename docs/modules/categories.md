# Categories

[Documentation index](../README.md)

Purpose: reusable nested catalog groups at /modules/categories.

Create/edit name, optional parent and active/inactive status. The backend generates an internal slug. Parent changes reject self-parenting and descendant cycles; hierarchy updates serialize concurrent changes.

The table shows parent context, product count and child count. Category-first product selectors include descendants and hierarchy paths. Category is picker context, not a submitted sales-line field.

/categories supports generic CRUD under products.view/create/update; delete also requires records.delete. Groups containing products/children cannot be deleted: reassign or mark inactive. Mutations invalidate all cached category-list variants after commit.

Data: categories.parent_id; products.category_id.

Sources: [resource service](../../backend/app/Services/DomainResourceService.php), [hierarchy utility](../../frontend/src/features/resources/category-hierarchy.ts), [picker](../../frontend/src/features/resources/CategoryProductPicker.tsx).

Review cycle handling, pagination of selectors and product-count invalidation after changes.

