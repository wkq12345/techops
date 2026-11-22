# Users and roles

[Documentation index](../README.md)

Purpose: manage internal accounts and Admin/Staff access at /modules/users. User name identifies a person; role name identifies an access group; slug is the stable machine identifier.

## Behavior and authorization

/users supports list/detail/create/update/delete under users.manage. Administrators create/edit name, email, password and access. Ordinary profile edits preserve job-specific roles unless access changes. Password/role changes revoke the affected user's sessions and API tokens.

User deletion is soft deletion. Self-deletion, self-demotion and removal of the last administrator are blocked. Both admin and legacy super-admin slugs count as administrators.

AppServiceProvider reserves users.manage and records.delete for administrators even if permission data were assigned to Staff. UI hiding is not sufficient security. There is no role CRUD endpoint.

## Data and sources

Tables: users, roles, permissions, user_roles and role_permissions. UserRoleService provisions Admin/Staff; legacy specialist roles remain supported.

[UserManagementService](../../backend/app/Services/UserManagementService.php), [UserRoleService](../../backend/app/Services/UserRoleService.php), [User model](../../backend/app/Models/User.php), [UserRecordForm](../../frontend/src/features/resources/UserRecordForm.tsx).

When changing access, review last-admin guards, token/session revocation and backend Staff authorization.

