# PC builds

[Documentation index](../README.md)

Purpose: component planning, compatibility and sales conversion at /modules/pc-builds.

Create/edit customer, budget, requirements and components. Saved lines determine the estimate. Compatibility checks evaluate saved components, not unsaved form edits. Duplicate creates a draft/template-style copy.

Acceptance needs an unconverted draft with components and no incompatible result. Missing-data warnings are not proof of compatibility and do not alone block acceptance. Conversion requires accepted/unconverted state and stock locations per component; it creates a sales order and marks converted.

API supports list/detail/create/PUT/PATCH and POST duplicate/accept/convert/validate under sales.create. DELETE additionally requires records.delete. Edit/delete are limited to unlinked drafts without reserved components/downstream links.

Data: pc_builds -> customer/optional sales order; pc_build_items and requirements. Lists show customer names; requests retain customer_id.

Sources: [PcBuildService](../../backend/app/Services/PcBuildService.php), [create form](../../frontend/src/features/resources/PcBuildCreateForm.tsx), [conversion form](../../frontend/src/features/resources/PcBuildConvertForm.tsx), [compatibility](attributes-and-compatibility.md).

Draft estimates do not guarantee future stock availability.

