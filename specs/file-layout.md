# Telos v2 File Layout

## Root Structure

```
~/.blackcat/telos/              # Root directory
├── config.yaml                 # Global configuration
├── schemas/                    # JSON schemas for validation
│   ├── project.md
│   └── task.yaml
├── projects/                   # Project metadata
│   ├── mnemo/
│   │   ├── project.md
│   │   ├── context.md          # Auto-generated from mnemo
│   │   └── README.md           # Optional project docs
│   └── black-cat/
│       ├── project.md
│       ├── context.md
│       └── README.md
├── tasks/                      # All tasks (global namespace)
│   ├── 1/                      # Task #1 folder
│   │   ├── task.yaml
│   │   ├── README.md
│   │   └── subtasks/           # Nested child tasks
│   │       └── 5/
│   │           ├── task.yaml
│   │           └── README.md
│   ├── 2/
│   │   ├── task.yaml
│   │   └── README.md
│   └── inbox/                  # Quick capture before sorting
│       ├── task.yaml           # Inbox metadata
│       └── README.md
├── templates/                  # Task templates
│   └── bug/
│       ├── template.yaml
│       └── README.md
├── archive/                    # Completed/cold tasks
│   └── 2026/
│       ├── 100/
│       │   ├── task.yaml
│       │   └── README.md
│       └── 101/
│           ├── task.yaml
│           └── README.md
├── docs/                       # Telos documentation
│   ├── project-schema.md
│   ├── task-schema.md
│   ├── file-layout.md          # This file
│   └── breaking-changes.md
└── scripts/                    # Migration and utilities
    └── migrate-to-folders.ts
```

## Design Rationale

### Why Folder-Based Tasks?

1. **Separation of concerns:** Metadata (task.yaml) vs narrative (README.md)
2. **Obsidian integration:** Each task is a note with backlinks, graph view
3. **Subtask hierarchy:** Natural filesystem nesting supports 5-level depth
4. **Future extensibility:** Attachments, logs, artifacts can go in task folder

### Why Global Task IDs?

- **Simple references:** "Task #15" is unambiguous
- **Cross-project blocking:** Task in project A can block task in project B
- **No ID collisions:** No need for project-scoped IDs

### Why Archive by Year?

- **Performance:** Active tasks folder stays small
- **History:** Preserved but out of the way
- **Backup:** Can archive old years separately

## Key Files

### config.yaml

Global configuration:

```yaml
version: "2.0.0"
tasks_root: "~/.blackcat/telos/tasks"
projects_root: "~/.blackcat/telos/projects"
archive_root: "~/.blackcat/telos/archive"
next_task_id: 50           # Auto-increment for new tasks
default_project: null      # Optional default for new tasks
```

### context.md (per project)

Auto-generated from mnemo memories tagged with project key:

```markdown
# Mnemo Context

## Relevant Memories
- [[memory:abc123]] - Architecture decision on embeddings
- [[memory:def456]] - User preference: local-first

## Recent Activity
- Task #12 completed (v1.2.1 release)
- Task #15 in progress (Phase 1)
```

## Empty Structure Creation

To initialize a fresh Telos v2 installation:

```bash
mkdir -p ~/.blackcat/telos/{projects,tasks,templates,archive,docs,scripts,schemas}

# Create config.yaml with defaults
cat > ~/.blackcat/telos/config.yaml << 'EOF'
version: "2.0.0"
tasks_root: "~/.blackcat/telos/tasks"
projects_root: "~/.blackcat/telos/projects"
archive_root: "~/.blackcat/telos/archive"
next_task_id: 1
default_project: null
EOF

# Create inbox task
mkdir -p ~/.blackcat/telos/tasks/inbox
cat > ~/.blackcat/telos/tasks/inbox/task.yaml << 'EOF'
id: 0
project_id: null
subject: Inbox
status: active
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
metadata:
  is_inbox: true
blockedBy: []
blocks: []
depth: 0
parent_id: null
EOF

cat > ~/.blackcat/telos/tasks/inbox/README.md << 'EOF'
# Inbox

Quick capture tasks before sorting into projects.
EOF
```

## Migration from v1

Existing tasks at `~/.telos/tasks/` will be:
1. Read and parsed
2. Converted to new format
3. Written to `~/.blackcat/telos/tasks/`
4. Original files preserved (manual cleanup after verification)

See `docs/breaking-changes.md` for details.
