# Kanban Board

Drag-and-drop kanban board with columns

A complete kanban board component with drag-and-drop functionality. Items can be moved between columns via drag. Includes a useKanban hook for state management. Supports custom item rendering and optional add-item buttons per column.

## Dependencies

shared-ui

## Files

Copy from `src/` in this directory to the app:

- `Kanban.tsx` → `src/components/Kanban.tsx`

## Wiring

1. Import: import { KanbanBoard, useKanban, KanbanItem, KanbanColumn } from './components/Kanban'
2. Define columns: const columns: KanbanColumn[] = [{ id: 'todo', title: 'To Do' }, ...]
3. Use hook or pass items directly: const { items, moveItem } = useKanban({ initialItems })
4. Render: <KanbanBoard columns={columns} items={items} onMoveItem={moveItem} />

## Patterns

- `KanbanItem: { id, title, description?, columnId }`
- `KanbanColumn: { id, title, color? }`
- `onMoveItem(itemId, toColumnId) → handle item moves`
- `onAddItem?(columnId) → handle add button clicks`
- `renderItem?(item) → custom card content`
- `useKanban({ initialItems, onItemMoved }) → { items, moveItem, addItem, ... }`
