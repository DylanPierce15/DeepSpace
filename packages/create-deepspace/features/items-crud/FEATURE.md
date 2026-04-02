# Items CRUD

Basic CRUD with ownership and RBAC permissions

A simple collection demonstrating ownership-based CRUD operations. Shows how to use ownerField for 'own' permission checks, userBound fields that auto-populate with current user ID, and immutable fields that cannot be changed after creation.

## Dependencies

shared-ui

## Files

Copy from `src/` in this directory to the app:

- `items-schema.ts` → `src/schemas/items-schema.ts`
- `items-constants.ts` → `src/constants/items-constants.ts`
- `ItemsPage.tsx` → `src/pages/ItemsPage.tsx`

## Wiring

1. Add to schemas.ts: import { itemsSchema } from './schemas/items-schema'
2. Add to schemas array: itemsSchema
3. Add to App.tsx: import ItemsPage from './pages/ItemsPage'
4. Add route: <Route path="/items" element={<ItemsPage />} />
5. Add navigation link for '/items'

## Patterns

- `useQuery<Item>('items', { orderBy: 'createdAt' })`
- `useMutations<Item>('items') → { create, put, remove }`
- `ownerField: 'ownerId' → enables 'own' permission`
- `userBound: true → auto-populates with current user ID`
