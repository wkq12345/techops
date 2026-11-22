# Authentication and account

[Documentation index](../README.md)

Purpose: internal staff sign-in at /login, recovery at /forgot-password and /reset-password, and identity/password management at /account. No public registration exists.

## Workflow and rules

The SPA obtains /sanctum/csrf-cookie before authentication writes. Login regenerates the session. Logout invalidates it and regenerates CSRF state. Password changes rotate the remember token and refresh the current session; other established sessions fail Sanctum's password-hash check. Password minimum is 12 characters.

POST /auth/login, /auth/forgot-password and /auth/reset-password are guest endpoints. GET /auth/user, POST /auth/logout and PUT /auth/password require a session. Throttles are declared on login/recovery/password change.

Users, sessions and password_reset_tokens hold durable identity/session state; Redis is not the session store. Reset links use FRONTEND_URL. Browser hostname, cookies and stateful domains must agree.

## Sources and limits

[AuthService](../../backend/app/Services/AuthService.php), [auth features](../../frontend/src/features/auth), [provider](../../backend/app/Providers/AppServiceProvider.php).

Authentication does not imply all permissions. The seeded development email is not deliverable; configure a real mailbox/transport to check recovery. Never log reset tokens or passwords.

