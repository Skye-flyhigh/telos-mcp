# Project Schema Specification (v2)

## Overview

Projects in Telos v2 are top-level organizational units that group related tasks. Each project has its own folder containing metadata, context, and documentation.

## File Location

```
~/.blackcat/telos/projects/{key}/
├── project.md    # This file
├── context.md      # Auto-generated from mnemo memories
└── README.md       # Optional project documentation
```

## Schema Fields

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Unique identifier (kebab-case, alphanumeric + hyphens) |
| `display_name` | string | Human-readable project name |
| `base_path` | string | Absolute filesystem path to project source |
| `status` | enum | One of: `active`, `paused`, `archived` |
| `created` | ISO8601 | Timestamp of creation |
| `updated` | ISO8601 | Timestamp of last modification |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | Project description |
| `tech_stack` | string[] | Technologies used (e.g., `["typescript", "sqlite"]` |
| `repo_url` | string | Git repository URL |
| `archived_at` | ISO8601 | When archived (null if active) |
| `archived_reason` | string | Why project was archived |

## Example

```yaml
key: mnemo
display_name: Mnemo Memory System
description: Local-first semantic memory for AI agents
base_path: /Users/skye/Documents/Coding/Nyx/black-cat/mnemo
tech_stack:
  - typescript
  - sqlite
  - nodejs
repo_url: https://github.com/skye/mnemo
status: active
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
```

## Validation Rules

1. **key uniqueness**: No two projects can share the same key
2. **key format**: Must match `^[a-z0-9-]+$` (lowercase, alphanumeric, hyphens)
3. **base_path existence**: Path should exist (warning if not, error if not creatable)
4. **repo_url format**: Must be valid URL if provided

## Migration from v1

v1 had no project concept. Tasks used `tags` for categorization.

Migration strategy:
1. Identify common tags that represent projects (e.g., "mnemo", "black-cat")
2. Create projects for each
3. Update tasks to reference `project_id` instead of project-like tags
4. Generate `MIGRATION_REPORT.md` with mappings
