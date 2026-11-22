# Mail and password recovery

[Documentation index](../README.md)

Purpose: send staff password-reset emails through Laravel mail. Operational reminders remain database notifications.

Local configuration supports Gmail SMTP at smtp.gmail.com:587 with STARTTLS. Privately configure MAIL_USERNAME and a Google App Password in backend/.env; never store credentials here. MAIL_FROM_ADDRESS can reference username. See [root Gmail instructions](../../README.md#gmail-smtp).

Reset links use FRONTEND_URL. A real staff mailbox is needed; admin@techops.local is not deliverable. Clear config cache and restart the intended backend runtime after changes.

log/array mailers do not deliver messages. Kubernetes deliberately uses log and must not import local Gmail secrets.

Sources: [mail config](../../backend/config/mail.php), [AuthService](../../backend/app/Services/AuthService.php), [provider](../../backend/app/Providers/AppServiceProvider.php).

A build does not verify provider authentication/delivery. Send tests only to a controlled recipient with permission; logs can contain sensitive reset links.

