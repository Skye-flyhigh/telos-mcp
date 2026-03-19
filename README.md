# telos-mcp

Task planning and tracking for AI agents. An MCP server with project-based organization and Obsidian-compatible markdown storage.

## What it does

Gives any MCP-compatible AI agent persistent task management:
- **Create, update, list, delete** tasks with full status tracking
- **Projects** — organize tasks by project with metadata (tech stack, repo URL, sources)
- **Dependencies** — blockedBy/blocks relationships between tasks
- **Bulk operations** — create multiple tasks at once
- **Task tree** — hierarchical view of tasks with parent-child relationships
- **Markdown files** — each task is a folder with README.md and YAML frontmatter
- **Obsidian integration** — full compatibility with Obsidian vaults, Dataview, and wiki links
- **Zero native addons** — pure JavaScript, works on any Node version without rebuild
- **Multi-agent** — owner tracking so you know who's doing what

## Quick start

```bash
npx telos-mcp
```

### Stable install

```bash
npm install -g telos-mcp
```

Or from source:

```bash
git clone https://github.com/skye-flyhigh/telos-mcp.git
cd telos-mcp && npm install && npm run build
```

Then point your client to `"command": "node", "args": ["/path/to/telos-mcp/dist/index.js"]`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TELOS_DIR` | `~/.telos` | Directory where task files are stored |

Set `TELOS_DIR` to override the default storage location:

```bash
TELOS_DIR=/custom/path npx telos-mcp
```

Or in the MCP config:

```json
{
  "mcpServers": {
    "telos": {
      "command": "npx",
      "args": ["telos-mcp"],
      "env": { "TELOS_DIR": "/custom/path" }
    }
  }
}
```

## Client Setup

### Claude Code

Add to `.claude.json`:

```json
{
  "mcpServers": {
    "telos": {
      "type": "stdio",
      "command": "npx",
      "args": ["telos-mcp"],
      "env": {}
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "telos": {
      "command": "npx",
      "args": ["telos-mcp"]
    }
  }
}
```


## Tools

### Task Management

| Tool | Description |
|------|-------------|
| `task_create` | Create a new task with subject, description, tags, dependencies, project_id |
| `task_update` | Update status, dependencies, project, or details of an existing task |
| `task_get` | Get full details of a task by ID |
| `task_list` | List all tasks (summary view), with optional filters |
| `task_delete` | Delete a task by ID (removes the folder) |
| `task_move` | Move a task to a different project (or to global tasks) |
| `task_create_bulk` | Create multiple tasks at once |
| `task_tree` | Get task hierarchy tree with all descendants |

### Project Management

| Tool | Description |
|------|-------------|
| `telos_project_create` | Create a new project for organizing tasks |
| `telos_project_get` | Get full project information by key |
| `telos_project_list` | List all projects with optional filtering |
| `telos_project_update` | Update project metadata |
| `telos_project_archive` | Archive a project (moves to archive/year/) |

## Status Workflow

```
pending → planning → in_progress → reviewing → completed
   ↓          ↓           ↓            ↓
blocked   archived    deleted
```

Use `status: "deleted"` in `task_update` to remove a task (same as `task_delete`).
Use `status: "archived"` to preserve task history without active tracking.

## Dependencies

Tasks can block each other:

- `blockedBy: [1, 3]` — this task can't start until tasks 1 and 3 complete
- When a task is completed, it's automatically removed from dependents' `blockedBy`
- When a task is deleted, all dependency references are cleaned up

## Storage Format

### Directory Structure

```
~/.telos/
├── tasks/                          # Global tasks (no project)
│   └── {id}-{slug}/
│       └── README.md
├── projects/
│   └── {key}/                      # e.g., "mnemo", "black-cat"
│       ├── project.md            # Project metadata
│       └── tasks/
│           └── {id}-{slug}/
│               └── README.md
└── archive/
    └── {year}/
        └── {key}/                  # Archived projects preserved
            ├── project.md
            └── tasks/
```

### Task Format

Each task is a folder with a README.md containing YAML frontmatter:

```markdown
---
id: 1
project_id: mnemo
subject: Fix authentication bug
status: in_progress
created: 2026-03-06T10:00:00.000Z
updated: 2026-03-06T12:30:00.000Z
owner: claude
activeForm: Fixing authentication bug
blockedBy: [3]
blocks: [5, 7]
tags: [backend, auth]
depth: 0
sources:
  - https://docs.example.com
  - https://github.com/org/repo/issues/42
---

Detailed description with full markdown support.
```

### Project Format

Each project is a `project.md` file with YAML frontmatter and markdown body:

```markdown
---
key: mnemo
display_name: Mnemo MCP
tech_stack: [typescript, mcp]
repo_url: "https://github.com/skye-flyhigh/mnemo"
status: active
created: "2026-03-06T10:00:00.000Z"
updated: "2026-03-06T12:00:00.000Z"
archived_at: null
archived_reason: null
sources:
  - https://modelcontextprotocol.io
---

Memory management for AI agents. Description goes here as markdown body.
```

## Obsidian Integration

Telos is designed for Obsidian compatibility:

- **Markdown files** — Every task is a README.md, every project is a project.md
- **YAML frontmatter** — Metadata in standard YAML format
- **Wiki links** — `[[project-key]]` links between tasks and projects
- **Dataview queries** — Dynamic tables for task and project lists
- **Graph view** — Visual task ↔ project relationships

Open `~/.telos` as an Obsidian vault for full visualization.

## License

MIT
