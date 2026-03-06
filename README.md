# telos-mcp

Task planning and tracking for AI agents. An MCP server with markdown file storage.

## What it does

Gives any MCP-compatible AI agent persistent task management:
- **Create, update, list, delete** tasks with full status tracking
- **Dependencies** — blockedBy/blocks relationships between tasks
- **Markdown files** — each task is a human-readable `.md` file with frontmatter
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

| Tool | Description |
|------|-------------|
| `task_create` | Create a new task with subject, description, tags, dependencies |
| `task_update` | Update status, dependencies, or details of an existing task |
| `task_get` | Get full details of a task by ID |
| `task_list` | List all tasks (summary view), with optional filters |
| `task_delete` | Delete a task by ID |

## Status Workflow

```
pending → in_progress → completed
```

Use `status: "deleted"` in `task_update` to remove a task (same as `task_delete`).

## Dependencies

Tasks can block each other:

- `blockedBy: [1, 3]` — this task can't start until tasks 1 and 3 complete
- When a task is completed, it's automatically removed from dependents' `blockedBy`
- When a task is deleted, all dependency references are cleaned up

## Storage Format

Each task is a markdown file at `~/.telos/{id}-{slug}.md`:

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
blocks: [2]
tags: [backend, auth]
metadata_sources: https://docs.example.com
metadata_pr: #42
---

Detailed description with full markdown support.
```

Filenames use slugified subjects for readability: `1-fix-authentication-bug.md`.

Metadata is stored as `metadata_` prefixed keys in frontmatter, reconstructed into a `{ key: value }` object on read.

A `.next_id` counter file tracks the next available task ID (prevents ID reuse after deletion). It's a dotfile — hidden by default.

Human-readable, git-friendly, works with Obsidian/any markdown viewer.

## License

MIT
