# Strategy Board

Strategy Board is a structured architecture workspace for modeling services, databases, queues, workers, APIs, and external systems. It helps engineers move from a loose diagram to a graph that can be validated, edited, imported, exported, and used as handoff documentation.

The product is aimed at service topology and communication design rather than freeform whiteboarding. Nodes have explicit types, edges have explicit relationship semantics, and validation rules can reason about the system you drew.

## Design Goal

Architecture diagrams tend to start as drawings and then drift away from implementation detail. Strategy Board keeps the model structured:

- nodes have explicit types
- edges have explicit relationship types
- metadata is stored as JSON-safe fields
- validation rules can reason about the graph
- exports can become handoff documentation

It is not a general whiteboard. It is a focused workspace for service topology and communication design.

The editor runs on the root route and stores the board locally in the browser. Server-side board persistence and real-time collaboration are outside the current scope.

## Canvas Model

### Node Types

| Type | Typical Use | Metadata |
| --- | --- | --- |
| API | Public or internal HTTP surface | endpoints, auth mode |
| Service | Application service | runtime, repository |
| Database | Data store | engine, tables |
| Queue | Broker or event bus | broker, topics |
| Worker | Async processor | schedule |
| External | Third-party dependency | vendor, URL |

### Edge Types

| Type | Meaning |
| --- | --- |
| `sync` | Blocking request/response |
| `async` | Event or message flow |
| `read` | Reads from a data store |
| `write` | Writes to a data store |
| `dependency` | Structural dependency |

Connection rules live in `resources/js/types/board.ts`. They are used both when creating edges and when validating an existing board.

## What You Can Do

- Add typed nodes from the left palette.
- Drag nodes on an infinite canvas.
- Pan with the wheel or space-drag.
- Zoom with command/control plus scroll.
- Select single or multiple nodes.
- Marquee-select nodes.
- Drag from a node port to create an edge.
- Edit node names, types, domains, tags, descriptions, and type-specific metadata.
- Edit edge type, label, latency, retry strategy, and retry limit.
- Copy, paste, duplicate, and delete selected nodes.
- Align selected nodes horizontally or vertically.
- Focus the connected flow around one selected node.
- Use a minimap to navigate the board.
- Undo and redo up to 100 snapshots.
- Import and export the board as JSON.
- Export a Markdown summary grouped by node type with connections listed below.

## Validation

The validation panel derives issues from the live graph:

- `invalid-edge`: edge type is not allowed between the selected node types
- `orphan-node`: node has no connected edges
- `multi-writer`: more than one service writes to the same database
- `circular-dependency`: cycle through `sync` or `dependency` edges
- `self-loop`: edge connects a node to itself

Issues carry node and edge ids, so clicking an issue selects and centers the affected part of the diagram.

## Persistence And Export

The board state is fully serializable:

```ts
interface BoardState {
    name: string;
    nodes: BoardNode[];
    edges: BoardEdge[];
    viewport: Viewport;
}
```

The editor saves to `localStorage` under `strategy-board.state.v1`. Import/export is file-based:

- JSON export preserves the full board model.
- JSON import replaces the current board.
- Markdown export creates a readable architecture document from the current model.

There is no backend board table, multi-user editing, sharing link, or real-time sync in the current implementation.

## Authentication Surface

The repository includes Laravel Fortify authentication and settings pages:

- login
- registration
- password reset
- email verification
- two-factor challenge
- profile settings
- security/password settings
- appearance settings

The authenticated dashboard route exists, and the Fortify/settings flows are covered by feature tests. The architecture board itself is available at `/` without authentication.

## Code Map

```text
resources/js/pages/Board.vue
    Full-screen Inertia page for the editor.

resources/js/components/board/Board.vue
    Composes toolbar, palette, canvas, minimap, issues panel, and inspector.

resources/js/components/board/Canvas.vue
    Pan/zoom surface, grid, marquee selection, dragging, and edge creation.

resources/js/components/board/Inspector.vue
    Context-sensitive editing for nodes, edges, multi-select, and board summary.

resources/js/composables/board/useBoardStore.ts
    Shared board state, persistence, selection, focus mode, and bulk replacement.

resources/js/composables/board/useBoardActions.ts
    History-aware mutations used by components.

resources/js/composables/board/useValidation.ts
    Derived graph issues.

resources/js/composables/board/useExport.ts
    JSON and Markdown export, JSON import.

resources/js/types/board.ts
    Board domain model, node/edge catalogs, validation rules, and sample board.

app/Providers/FortifyServiceProvider.php
routes/settings.php
    Authentication and account settings surface.
```

## Stack

| Layer | Tools |
| --- | --- |
| Backend | Laravel 13, PHP 8.3+, Inertia Laravel |
| Auth | Laravel Fortify |
| Frontend | Vue 3, TypeScript, Vite, Tailwind CSS 4 |
| UI | lucide-vue-next, Reka UI components |
| State | Vue composables and browser localStorage |
| Quality | PHPUnit, Pint, ESLint, Prettier, vue-tsc |

## Local Setup

```bash
composer install
npm ci
cp .env.example .env
php artisan key:generate
```

Configure the database connection in `.env` before running migrations.

```bash
php artisan migrate
```

Start the full development stack:

```bash
composer dev
```

Or run processes separately:

```bash
php artisan serve
npm run dev
```

## Build

```bash
npm run build
```

The repository also defines an SSR build command:

```bash
npm run build:ssr
```

## Tests And Checks

Run PHP tests and backend style checks:

```bash
composer test
composer lint:check
```

Run frontend checks:

```bash
npm run lint:check
npm run format:check
npm run types:check
```

Apply formatting fixes:

```bash
composer lint
npm run lint:fix
npm run format
```

Run the combined check script:

```bash
composer ci:check
```

## Current Limits

- Board data is stored in the browser, not in the database.
- There is no collaboration, commenting, version history, or sharing flow.
- Exported Markdown is generated from the structured model, not from a rendered diagram image.
- The validation rules are intentionally opinionated and do not cover every architecture concern.
- Existing tests focus on Laravel auth/settings and route coverage; the board editor logic still needs dedicated unit tests.

## Contributing

Treat the board model as the contract. UI changes should preserve import/export compatibility unless a migration path is added.

Good contribution areas:

- tests for board reducers, validation rules, and export output
- additional node metadata that stays JSON-safe
- better layout helpers without replacing manual positioning
- accessibility improvements for canvas and inspector controls
- import validation before replacing the current board

Before opening a pull request, run:

```bash
composer ci:check
npm run build
```

## License

Strategy Board is open-sourced under the MIT license. See `LICENSE`.
