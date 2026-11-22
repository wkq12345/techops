# Attributes and compatibility

[Documentation index](../README.md)

Purpose: structured product characteristics and saved-build compatibility checks.

Attributes define name, unique slug, text/number/boolean type and optional unit. /attributes generic CRUD requires products.view/create/update; delete also needs records.delete. There is no dedicated Attributes navigation page or declared product-attribute-value editing endpoint.

ProductAttributeValue supplies the values consumed by CompatibilityService. CompatibilityRule exists as a model, but active checks are service code, not a demonstrated dynamic rules editor.

| Check | Slugs |
| --- | --- |
| CPU/motherboard | socket |
| RAM/motherboard | ram-type |
| Board/case | form-factor, supported-form-factors |
| GPU clearance | length-mm, max-gpu-length-mm |
| Cooler clearance | height-mm, max-cooler-height-mm |
| PSU | wattage, CPU/GPU tdp-watts with 20% headroom |

Results include compatible/incompatible/warning and messages. Some missing component/attribute pairs are skipped; an all-compatible result is not a complete certification. Missing PSU data or an empty result set can emit warnings.

Sources: [CompatibilityService](../../backend/app/Services/CompatibilityService.php), [UI](../../frontend/src/features/resources/PcBuildCompatibility.tsx), [validation](../../backend/app/Http/Requests/DomainResourceRequest.php).

Text containment for form factors and estimated power are limited checks, not a full hardware compatibility engine.

