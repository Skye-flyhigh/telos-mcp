# Breaking Changes: Telos v1 → v2

## Summary

Telos v2 introduces **project-based organization** and **folder-based task structure**. This is a foundational change that affects storage format, file locations, and data models.

## Key Changes

### 1. Storage Location

| v1 | v2 |
|----|-----|
| `~/.telos/` | `~/.blackcat/telos/` |

**Impact:** Existing tasks remain in v1 location during migration period.

### 2. Task File Format

| v1 | v2 |
|----|-----|
| Single file: `{id}-{slug}.md` | Folder: `tasks/{id}/task.yaml + README.md` |
| Frontmatter + body combined | Metadata and description separated |
| Flat structure | Nested subtasks supported (max depth 5) |

**Example:**

**v1 (`tasks/1-fix-bug.md`):**
```markdown
---
id: 1
subject: Fix bug
tags: [mnemo, bug]
status: pending
---
Description here...
```

**v2 (`tasks/1/task.yaml`):**
```yaml
id: 1
project_id: mnemo
subject: Fix bug
status: pending
# ... other fields
```

**v2 (`tasks/1/README.md`):**
```markdown
# Fix bug

Description here...
```

### 3. Project Concept

| v1 | v2 |
|----|-----|
| No project entity | First-class projects with metadata |
| Tags for categorization | `project_id` field on tasks |
| No base_path | Projects link to source code locations |

**Migration:** Tags like `"mnemo"`, `"black-cat"` become projects.

### 4. Metadata Schema

**v1 fields (flat):**
- `id`, `subject`, `status`, `owner`, `tags`, `blockedBy`, `blocks`, `description` (in body)

**v2 fields (hierarchical):**
- Task: `id`, `project_id`, `subject`, `status`, `owner`, `metadata`, `blockedBy`, `blocks`, `context_capture`, `parent_id`, `depth`
- Project: `key`, `display_name`, `description`, `base_path`, `tech_stack`, `repo_url`, `status`, `created`, `updated`

**Changes:**
- `tags` → removed (use `project_id` + `metadata`)
- `description` → moved to `README.md`
- `context_capture` → new (auto-saved git/files context)
- `parent_id`, `depth` → new (subtask hierarchy)

### 5. MCP Operations

| v1 | v2 |
|----|-----|
| `task_create` | Enhanced with `project_id` |
| `task_update` | Same |
| `task_get` | Enhanced with subtask expansion |
| `task_list` | Enhanced with project filtering |
| `task_delete` | Same |
| (none) | `telos_project_create` |
| (none) | `telos_project_list` |
| (none) | `telos_project_archive` |

## Migration Script

Run the migration tool:

```bash
cd ~/.blackcat/telos
npm run migrate
```

This will:
1. Scan `~/.telos/tasks/*.md` for existing tasks
2. Identify project-like tags (heuristic: tags appearing on >3 tasks)
3. Create project folders in v2 location
4. Convert tasks to new format
5. Generate `MIGRATION_REPORT.md` with before/after mapping
6. **Not delete v1 files** (manual cleanup required after verification)

## Rollback

If issues occur:

```bash
rm -rf ~/.blackcat/telos/
# v1 files still intact at ~/.telos/
```

## Timeline

1. **Phase 1 (now):** v2 implementation, parallel with v1
2. **Phase 2:** Complete migration, mark v1 read-only
3. **Phase 3:** Remove v1 compatibility layer

## Questions?

See `docs/project-schema.md` and `docs/task-schema.md` for full specifications.
