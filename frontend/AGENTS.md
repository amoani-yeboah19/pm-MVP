# Frontend — Kanban Studio

## Overview

A Next.js 16 + React 19 frontend-only Kanban board. All state is currently in-memory (no backend integration yet). Built with TypeScript, Tailwind CSS v4, and @dnd-kit for drag-and-drop. This is the starting point for Parts 3–10 of the project plan.

## Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Drag-and-drop**: @dnd-kit/core + @dnd-kit/sortable
- **Unit tests**: Vitest + @testing-library/react + @testing-library/user-event
- **E2E tests**: Playwright
- **Coverage**: @vitest/coverage-v8 (threshold not yet configured — will be set to ≥80% in Part 3)

## Directory Layout

```
frontend/
  src/
    app/
      page.tsx            — root page, renders <KanbanBoard />
      layout.tsx          — root layout: Google fonts (Space Grotesk, Manrope), globals.css
      globals.css         — CSS custom properties (color tokens, shadows, fonts)
    components/
      KanbanBoard.tsx     — top-level board: owns all state, DnD context, all handlers
      KanbanColumn.tsx    — single column: useDroppable, renders cards + NewCardForm
      KanbanCard.tsx      — single card: useSortable, title, details, delete button
      KanbanCardPreview.tsx — drag overlay ghost card (no actions)
      NewCardForm.tsx     — toggle form to add a card (title required, details optional)
    lib/
      kanban.ts           — types, initialData, moveCard(), createId()
      kanban.test.ts      — Vitest unit tests for moveCard()
    components/
      KanbanBoard.test.tsx — Vitest + RTL component tests
    test/
      setup.ts            — extends expect with @testing-library/jest-dom matchers
      vitest.d.ts         — type augmentation for jest-dom matchers
  tests/
    kanban.spec.ts        — Playwright E2E tests
  vitest.config.ts        — Vitest config with jsdom environment
  playwright.config.ts    — Playwright config (baseURL: localhost:3000)
  next.config.ts          — Next.js config (not yet set to static export)
  package.json
```

## Data Model

```ts
type Card     = { id: string; title: string; details: string }
type Column   = { id: string; title: string; cardIds: string[] }
type BoardData = { columns: Column[]; cards: Record<string, Card> }
```

Five fixed columns with stable IDs: `col-backlog`, `col-discovery`, `col-progress`, `col-review`, `col-done`. Eight sample cards in `initialData`. Cards are keyed by ID in a flat map; columns hold ordered arrays of card IDs.

## Key Logic (`src/lib/kanban.ts`)

- `moveCard(columns, activeId, overId)` — pure function for drag-end. When `overId` is a column ID the card is appended to that column's end. When `overId` is a card ID, the dragged card is inserted before it (same-column reorder or cross-column insert).
- `createId(prefix)` — generates a unique ID from a random base-36 string + a timestamp suffix.
- All board mutations in `KanbanBoard` are immutable updates to the `board` state value.

## Color Tokens (from `globals.css`)

```
--accent-yellow:    #ecad0a   (column indicators, highlights)
--primary-blue:     #209dd7   (links, focus rings, add-card button)
--secondary-purple: #753991   (submit buttons)
--navy-dark:        #032147   (headings, primary text)
--gray-text:        #888888   (labels, secondary text)
--surface:          #f7f8fb   (page background)
--surface-strong:   #ffffff   (cards, column backgrounds)
--stroke:           rgba(3,33,71,0.08)
--shadow:           0 18px 40px rgba(3,33,71,0.12)
```

## State Management

All board state lives in `KanbanBoard` as a single `BoardData` useState. No context, no global store. Handlers passed down as props:

| Handler | What it does |
|---|---|
| `handleRenameColumn(columnId, title)` | Updates column title in place |
| `handleAddCard(columnId, title, details)` | Creates a new card and appends to column |
| `handleDeleteCard(columnId, cardId)` | Removes card from map and from column.cardIds |
| `handleDragStart` | Stores `activeCardId` for DragOverlay |
| `handleDragEnd` | Calls `moveCard()` and updates `board.columns` |

## Existing Tests

| File | Framework | Tests | What is covered |
|---|---|---|---|
| `src/lib/kanban.test.ts` | Vitest | 3 | `moveCard`: same-column reorder, cross-column move, drop on column |
| `src/components/KanbanBoard.test.tsx` | Vitest + RTL | 3 | Renders 5 columns; rename column; add card then delete card |
| `tests/kanban.spec.ts` | Playwright | 3 | Page loads with board; add a card; drag a card between columns |

## Test Commands

```bash
npm run test:unit        # Vitest unit + component tests (single run)
npm run test:unit:watch  # Vitest in watch mode
npm run test:e2e         # Playwright E2E (requires next dev running on :3000)
npm run test:all         # Unit then E2E
```

## What Is Not Yet Present

- No login/auth
- No API client or backend integration
- No persistent state (page reload resets board to `initialData`)
- No AI sidebar
- No static export configuration (needed for Docker in Part 3)
- No coverage threshold enforcement
