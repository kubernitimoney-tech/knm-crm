# Accounts App

## 1. Purpose

Identity, authentication (JWT), and enterprise RBAC. Custom `User` model, roles, permissions, Redis-backed permission cache.

## 2. Folder structure

```
accounts/
├── authentication/jwt_authentication.py
├── management/commands/seed_permissions.py
├── models/ (user, role, permission)
├── permissions/rbac.py
├── selectors/permission_selectors.py
├── services/ (auth, token, permission_cache)
├── serializers/
├── views/
├── urls/
└── tests/
```

## 3. Database schema

- **User**: UUID PK, email (login), profile, flags
- **Permission**: module, action, code (unique)
- **Role**: name, slug
- **UserRole**, **RolePermission**: junction tables

## 4. Relationships

`User` ←→ `Role` (M2M via UserRole) ←→ `Permission` (M2M via RolePermission)

## 5. Sample records

After `seed_permissions`: roles `relationship-manager`, `operations-executive`, `admin` with codes like `loan.approve`, `customer.view`.

## 6. API examples

```http
POST /api/v1/auth/login/
{ "email": "admin@kubernitimoney.com", "password": "Admin@123" }

POST /api/v1/auth/refresh/
{ "refresh": "<token>" }

GET /api/v1/accounts/users/
Authorization: Bearer <access>
```

## 7. Permission matrix

| Endpoint | Permission |
|----------|------------|
| List users | user.view |
| Create user | user.create |
| List roles | role.view |

## 8. Authentication flow

1. `LoginAPIView` → `AuthService.login` → `TokenService.issue_tokens`
2. Each request: `JWTAuthentication.authenticate` → validates access token → sets `request.user`, `request.auth` (claims)
3. Logout: blacklist refresh token

## 9. RBAC flow

1. `HasRBACPermission.has_permission` → `resolve_user_permissions(user)`
2. Cache miss → `get_user_permission_codes` (DB with prefetch)
3. Cache set `user:{id}:permissions` TTL 1h
4. Signals invalidate on UserRole / RolePermission changes

## 10. Middleware flow

`AuditContextMiddleware` (audit_logs) runs before views; JWT auth runs in DRF `initial()`.

## 11. Activity timeline

N/A (see activities app).

## 12. Service layer flow

`AuthService` / `TokenService` — no business logic in views.

## 13. Database query flow

`get_user_permission_codes`: `UserRole` → prefetch `role__role_permissions__permission` — avoids N+1.
