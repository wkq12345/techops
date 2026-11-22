# Warranties

[Documentation index](../README.md)

Purpose: track coverage at /modules/warranties.

Manual create takes optional customer/product/unit/reference, required integer warranty_months (1-1200) and status. Backend starts today, calculates the end without month overflow and sets standard type. Users do not type start/end dates or warranty type.

Editing duration recalculates end from the saved start. Sales completion automatically issues eligible product warranties. Reminder processing expires old active coverage and notifies about approaching expiry.

/warranties supports generic CRUD under products.view/create/update; delete additionally needs records.delete and is blocked by claims. WAR numbers are automatic. Tables display customer name and dates/status.

Sources: [resource service](../../backend/app/Services/DomainResourceService.php), [SalesService](../../backend/app/Services/SalesService.php), [reminder command](../../backend/app/Console/Commands/SendOperationalReminders.php).

Coverage records do not automatically approve claims or send customer email. See [claims](warranty-claims.md).

