# Notifications and scheduler

[Documentation index](../README.md)

Purpose: in-app staff messages and deduplicated reminders.

NotificationService targets users/permission groups through OperationalNotification's database channel. GET /notifications and POST /notifications/{id}/read operate on the authenticated user's messages.

ops:send-reminders is scheduled daily at 08:30 Asia/Kuala_Lumpur without overlap in backend/bootstrap/app.php:

- Active repairs unchanged for at least 3 days.
- Open POs past expected date.
- Confirmed/processing sales open for at least 2 days.
- Active warranties expiring within 7 days; expired active coverage is updated.

operational_reminders holds per-record/state/user deduplication keys. Running this command changes data and is not a read-only check.

Windows needs a schedule runner; Compose has scheduler; Kubernetes calls schedule:run every minute, while Laravel executes business work only when due. Avoid multiple scheduler runtimes targeting one database unnecessarily.

Sources: [command](../../backend/app/Console/Commands/SendOperationalReminders.php), [service](../../backend/app/Services/NotificationService.php), [notification](../../backend/app/Notifications/OperationalNotification.php).

Use schedule:list for registration inspection. Messages are not customer mail/SMS or demonstrated realtime push.

