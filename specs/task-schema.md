# Task Schema Specification (v2)

## Overview

Tasks in Telos v2 use a folder-based structure separating metadata (machine-readable) from description (human-readable).

## Breaking Change from v1

**v1 (flat file):**
```
~/.telos/tasks/
└── 1-fix-bug.md          # Metadata in YAML frontmatter, description in body
```

**v2 (folder-based):**
```
~/.blackcat/telos/tasks/
└── 1/
    ├── task.yaml         # Metadata only
    ├── README.md         # Description (human narrative)
    └── subtasks/         # Nested tasks (Phase 2)
        └── 2/
            ├── task.yaml
            └── README.md
```

## File Structure

```
tasks/{id}/
├── task.yaml           # Required: Task metadata
├── README.md           # Required: Task description
└── subtasks/           # Optional: Nested child tasks
    └── {child-id}/
        ├── task.yaml
        └── README.md
```

## Schema Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Global unique identifier |
| `project_id` | string | Reference to project key |
| `subject` | string | Brief imperative description |
| `status` | enum | See status values below |
| `created` | ISO8601 | Creation timestamp |
| `updated` | ISO8601 | Last modification timestamp |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `owner` | string \| null | Task owner (null = unassigned) |
| `metadata` | object | Free-form key-value pairs |
| `blockedBy` | int[] | Task IDs that block this task |
| `blocks` | int[] | Task IDs blocked by this task |
| `context_capture` | object | Snapshot at creation time |
| `parent_id` | int \| null | Parent task (Phase 2) |
| `depth` | integer | Nesting depth (0-5) |

## Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Waiting to start |
| `planning` | In design phase (requires approval to proceed) |
| `in_progress` | Actively being worked on |
| `reviewing` | Completed, awaiting review |
| `blocked` | Cannot proceed (see blockedBy) |
| `completed` | Done |
| `archived` | Historical, no longer active |

## Context Capture

Auto-saved when task is created (if `capture_context: true`):

```yaml
context_capture:
  head_commit: "abc123def456"
  open_files:
    - "src/index.ts"
    - "README.md"
  timestamp: "2026-03-12T00:00:00Z"
```

## Metadata Conventions

Common metadata keys (not enforced, but recommended):

| Key | Type | Purpose |
|-----|------|---------|
| `priority` | "high" \| "medium" \| "low" | Importance |
| `estimated_hours` | number | Time estimate |
| `actual_hours` | number | Time spent |
| `sprint` | string | Sprint/cycle identifier |
| `github_issue` | number | Linked GitHub issue |

## Example

**task.yaml:**
```yaml
id: 15
project_id: telos
subject: Build project-based task system
status: in_progress
owner: skye
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
metadata:
  priority: high
  estimated_hours: 16
blockedBy: [16, 17, 18]
blocks: [22, 23, 24, 25, 26, 27]
context_capture:
  head_commit: "21d7087"
  open_files:
    - "src/index.ts"
  timestamp: "2026-03-12T00:00:00Z"
parent_id: null
depth: 0
```

**README.md:**
```markdown
# Build project-based task system

## Context
Telos v1 used flat files with tags. For better organization and Obsidian integration, we need project-scoped tasks with hierarchy.

## Task Details
Implement Phase 1 of the Telos v2 spec: schemas, operations, and migration tooling.

## Architecture
- Folder-based: `tasks/{id}/task.yaml + README.md`
- Global task IDs across all projects
- Project reference via `project_id` field

## Dependencies
- #16: Define project.md schema
- #17: Define task.yaml schema
- #18: Design file layout

## Implementation Steps
1. Create schemas/ directory with YAML validation
2. Define TypeScript interfaces
3. Implement telos_project_create operation
4. ...
```

## Migration from v1

See `docs/breaking-changes.md` for detailed migration guide.

Quick summary:
1. Parse existing `{id}-{slug}.md` files
2. Extract frontmatter → task.yaml
3. Extract body → README.md
4. Create folder structure
5. Remove slug from filename (now just {id}/)
