# Telos — Task Planning MCP Server

## Context

Claude Code has built-in task management tools (TaskCreate, TaskUpdate, TaskGet, TaskList) but they're internal — not available as an MCP server for other agents or clients. Telos extracts this capability into a standalone MCP server that any MCP client can use. Named from Greek *telos* (purpose/goal).

Key constraint: **no native addons**. Mnemo's `better-sqlite3` + `sqlite-vec` caused ABI mismatch hell with npx. Telos uses markdown files with YAML frontmatter — human-readable, git-friendly, zero compilation issues.

## Project Location

`/Users/skye/Documents/Coding/Nyx/black-cat/telos` (sibling to `mnemo/`)

npm package: `telos-mcp`

## Architecture

```
telos/
├── src/
│   ├── index.ts      # MCP server, tool registration
│   ├── store.ts      # File-based task store (read/write .md files)
│   ├── types.ts      # Task types, config, constants
│   └── utils.ts      # ID generation, frontmatter parse/serialize
├── test/
│   ├── store.test.ts # Store unit tests
│   └── tools.test.ts # MCP tool integration tests
├── package.json
├── tsconfig.json     # Same as mnemo (ES2022, Node16, strict)
└── README.md
```

## Dependencies (zero native addons)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "zod": "^3.25.67"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "typescript": "^5.8.3",
    "vitest": "^4.0.18"
  }
}
```

No YAML library — write a minimal frontmatter parser/serializer. The format is constrained (we know every field), so a ~40-line parser is safer than adding a dependency.

## Storage Format

Default path: `~/.telos/` (configurable via `TELOS_DIR`)

Each task is a file: `~/.telos/{id}.md`

```markdown
---
id: 1
subject: Fix authentication bug
status: pending
created: 2026-03-06T10:00:00Z
updated: 2026-03-06T10:00:00Z
owner: echo
activeForm: Fixing authentication bug
blockedBy: []
blocks: []
tags: [backend, auth]
---

Detailed description of what needs to be done.
Supports full markdown — lists, code blocks, etc.
```

**Why this format:**
- Human-readable (open in any editor/viewer)
- Git-friendly (meaningful diffs)
- No database = no ABI issues, no corruption risk
- Standard frontmatter convention (works with Obsidian, Jekyll, etc.)

**ID generation:** Auto-incrementing integers (scan directory for max ID + 1). Simple, predictable, matches Claude Code convention.

## Types (`types.ts`)

```typescript
export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
  id: number;
  subject: string;
  description: string;
  status: TaskStatus;
  created: string;      // ISO 8601
  updated: string;      // ISO 8601
  owner: string;
  activeForm: string;
  blockedBy: number[];  // Task IDs
  blocks: number[];     // Task IDs
  tags: string[];
}

export interface TaskSummary {
  id: number;
  subject: string;
  status: TaskStatus;
  owner: string;
  blockedBy: number[];
}

export interface TelosConfig {
  dir: string;  // Storage directory
}

export function loadConfig(): TelosConfig {
  return {
    dir: process.env.TELOS_DIR ?? join(homedir(), ".telos"),
  };
}
```

## MCP Tools (5 tools)

### 1. `task_create`
Create a new task. Returns the created task.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | string | yes | Brief imperative title |
| `description` | string | no | Detailed markdown description |
| `activeForm` | string | no | Present-continuous spinner text |
| `owner` | string | no | Who owns this task |
| `blockedBy` | number[] | no | Task IDs that block this |
| `tags` | string[] | no | Categorization tags |

### 2. `task_update`
Update an existing task.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `taskId` | number | yes | Task to update |
| `status` | enum | no | pending / in_progress / completed / deleted |
| `subject` | string | no | New subject |
| `description` | string | no | New description |
| `activeForm` | string | no | New spinner text |
| `owner` | string | no | New owner |
| `addBlockedBy` | number[] | no | Add blocking dependencies |
| `addBlocks` | number[] | no | Add tasks this blocks |
| `tags` | string[] | no | Replace tags |

`status: "deleted"` removes the file (like Claude Code).

### 3. `task_get`
Get full task details by ID.

| Param | Type | Required |
|-------|------|----------|
| `taskId` | number | yes |

### 4. `task_list`
List all tasks (summary view — id, subject, status, owner, blockedBy). Optional filters.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | enum | no | Filter by status |
| `owner` | string | no | Filter by owner |
| `tag` | string | no | Filter by tag |

### 5. `task_delete`
Delete a task by ID (removes the file).

| Param | Type | Required |
|-------|------|----------|
| `taskId` | number | yes |

## Store (`store.ts`)

File-based task store. All operations are synchronous (fs).

```typescript
export class TaskStore {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  create(task: Omit<Task, "id" | "created" | "updated">): Task
  get(id: number): Task | null
  list(filters?: { status?: TaskStatus; owner?: string; tag?: string }): TaskSummary[]
  update(id: number, fields: Partial<Task>): Task | null
  delete(id: number): boolean

  private nextId(): number        // scan dir for max + 1
  private taskPath(id: number): string  // `${dir}/${id}.md`
  private readTask(path: string): Task  // parse frontmatter + body
  private writeTask(task: Task): void   // serialize frontmatter + body
}
```

## Frontmatter Parser (`utils.ts`)

Minimal, dependency-free. Handles only the types we need:
- Strings, numbers, string arrays (`[a, b, c]`), number arrays
- No nested objects, no multi-line values

```typescript
export function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string }
export function serializeFrontmatter(data: Record<string, unknown>, body: string): string
export function isoNow(): string
```

~40 lines total. The format is strict and known — no need for a full YAML parser.

## Dependency Management (blockedBy/blocks)

When `addBlockedBy: [3]` is called on task 5:
1. Add `3` to task 5's `blockedBy`
2. Add `5` to task 3's `blocks`
3. Write both files

When a task is completed:
1. Remove it from all other tasks' `blockedBy` arrays
2. Write affected files

When a task is deleted:
1. Remove it from all `blockedBy` and `blocks` arrays
2. Delete the file

## What this does NOT do

- No semantic search (use mnemo for that)
- No decay (tasks are explicit, not cognitive)
- No embeddings
- No parent-child hierarchy (keep it flat, add later if needed)
- No persistent cross-session state beyond the files themselves
- No `metadata` object (use `tags` for categorization — simpler)

## Verification

```bash
# Build
npm run build

# Tests
npm test

# Manual test via Claude Code MCP config:
# Point to: node /path/to/telos/dist/index.js
# Then: task_create, task_list, task_get, task_update, task_delete

# Verify no native addons:
# npx telos-mcp should work on any Node version without rebuild
```
