# Admin Panel

User management and app settings

Admin panel for managing users and app settings. Demonstrates useUsers hook for listing all users, setRole for changing user roles, admin-only collections, and protected routes.

## Dependencies

shared-ui

## Files

Copy from `src/` in this directory to the app:

- `admin-schema.ts` → `src/schemas/admin-schema.ts`
- `AdminPage.tsx` → `src/pages/AdminPage.tsx`

## Wiring

1. Add to schemas.ts: import { settingsSchema } from './schemas/admin-schema'
2. Add to schemas array: settingsSchema
3. Add to App.tsx: import AdminPage from './pages/AdminPage'
4. Add protected route: <ProtectedRoute allowedRoles={[ROLES.ADMIN]}><AdminPage /></ProtectedRoute>
5. Add navigation link for '/admin' (admin only)

## Patterns

- `useUsers() → { users, setRole }`
- `setRole(userId, 'member') → change user role`
- `Admin-only collection: all permissions false for viewer/member`
- `Check: user.role === 'admin'`
