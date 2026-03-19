#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { projectArchive, projectCreate, projectList } from "./operations/projects.js";
import { formatTaskTree, getTaskTree, taskCreateBulk, taskMove } from "./operations/tasks.js";
import { ProjectStore } from "./project-store.js";
import { TaskStore } from "./task-store.js";
import { VALID_TASK_STATUSES } from "./types.js";

const config = loadConfig();
const taskStore = new TaskStore(config.tasks_root, config.projects_root);
const projectStore = new ProjectStore(config.projects_root, config.archive_root);

const server = new McpServer({
  name: "telos-mcp",
  version: "0.2.0",
});

const descriptionStructure: string = `
When planning, document yourself regarding the task (e.g. search information online (use web_search tool if allowed), consult the codebase or ask further questions before delivering a plan). Preparing a plan can take several task update cycles until all the information is gathered.

Structured description, details points when applicable:
- Context: explain the why, and overall view how to solve the problem
- Task details
- Task location: where the task takes place (filepath or physical location, etc.)
- Architecture: final structure of the expected output
- Dependencies: explain what are required for delivery
- Examples of the deliverable and expectations
- Reasoning for the offered solution
- Foreseen barriers and solution (from task context)
- Implementation steps: real, commitable implementation steps, questions to ask the user for clarification and decision
- Testing plan
- Deployment plan
- Sources and reference: explicitely list the sources used to design the plan, or say no sources have been used.
`;

const taskRecords = {
  subject: z.string().describe("Brief imperative title (e.g. 'Fix auth bug')"),
  description: z.string().optional().describe(`Detailed markdown description. \n ${descriptionStructure}`),
  owner: z.string().optional().describe("Who owns this task"),
  project_id: z.string().optional().describe("Project key this task belongs to"),
  parent_id: z.number().optional().describe("Parent ID, task parent ID whom task is related to"),
  tags: z.array(z.string()).optional().describe("Task tags"),
  metadata: z.record(z.string()).optional().describe("Arbitrary key-value pairs (e.g. { pr: '#42', priority: 'high' })"),
  sources: z.array(z.string()).optional().describe("URLs, references, documentation used for this task (e.g. ['https://docs.example.com', 'Claude Code Plan Mode analysis'])"),
}

// For updates, subject is optional
const taskUpdateRecord = {
  subject: z.string().optional().describe("Brief imperative title (e.g. 'Fix auth bug')"),
  description: z.string().optional().describe(`Detailed markdown description. \n ${descriptionStructure}`),
  owner: z.string().optional().describe("Who owns this task"),
  project_id: z.string().optional().describe("Project key this task belongs to"),
  parent_id: z.number().optional().describe("Parent ID, task parent ID whom task is related to"),
  tags: z.array(z.string()).optional().describe("Task tags"),
  metadata: z.record(z.string()).optional().describe("Arbitrary key-value pairs (e.g. { pr: '#42', priority: 'high' })"),
  sources: z.array(z.string()).optional().describe("URLs, references, documentation used for this task (e.g. ['https://docs.example.com', 'Claude Code Plan Mode analysis'])"),
}

type TaskVariant = "update" | "filter"

const taskStatus = (variant: TaskVariant) => {
  const description =
    variant === "update"
      ? "New status (deleted removes the task)"
      : "Filter by status"

  return z.enum(VALID_TASK_STATUSES).optional().describe(description)
}

const projectRecords = {
  display_name: z.string().min(1).describe("Human-readable project name"),
  description: z.string().optional().describe("Optional project description explaining the context of the project"),
  base_path: z.string().optional().describe("Absolute path to project source code"),
  tech_stack: z.array(z.string()).optional().describe("Technologies used"),
  repo_url: z.string().url().optional().describe("Git repository URL"),
  sources: z.array(z.string()).optional().describe("Initial references, documentation, or research sources for the project"),
}

// ── task_create ─────────────────────────────────────────────────

server.registerTool(
  "task_create",
  {
    description: "Create a new task for tracking work",
    inputSchema: {
      ...taskRecords,
      blockedBy: z.array(z.number()).optional().describe("Task IDs that must complete first"),
    }
  },
  async (params) => {
    const task = taskStore.createTask(params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
    };
  },
);

// ── task_update ─────────────────────────────────────────────────

server.registerTool(
  "task_update",
  {
    description: "Update an existing task's status, dependencies, or details",
    inputSchema: {
      taskId: z.number().describe("The task ID to update"),
      ...taskUpdateRecord,
      status: taskStatus("update"),
      addBlockedBy: z.array(z.number()).optional().describe("Task IDs to add as blockers"),
      addBlocks: z.array(z.number()).optional().describe("Task IDs that this task blocks"),
      metadata: z.record(z.string().nullable()).optional().describe("Merge metadata keys into the task. Set a key to null to delete it."),
    }
  },
  async (params) => {
    const { taskId, ...fields } = params;
    const task = taskStore.update(taskId, fields);

    if (!task && fields.status === "deleted") {
      return {
        content: [{ type: "text" as const, text: `Task ${taskId} deleted.` }],
      };
    }

    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Task ${taskId} not found.` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
    };
  },
);

// ── task_get ────────────────────────────────────────────────────

server.registerTool(
  "task_get",
  {description: "Get full details of a task by ID",
  inputSchema: {
    taskId: z.number().describe("The task ID to retrieve"),
  }},
  async ({ taskId }) => {
    const task = taskStore.get(taskId);

    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Task ${taskId} not found.` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }],
    };
  },
);

// ── task_list ───────────────────────────────────────────────────

server.registerTool(
  "task_list",
  {description: "List all tasks (summary view: id, subject, status, owner, blockedBy)",
    inputSchema: {
    status: taskStatus("filter"),
    owner: z.string().optional().describe("Filter by owner"),
    project_id: z.string().optional().describe("Filter by project"),
  }},
  async (params) => {
    const tasks = taskStore.list(params);

    if (tasks.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No tasks found." }],
      };
    }

    const lines = tasks.map((t) => {
      const owner = t.owner ? ` @${t.owner}` : "";
      const project = t.project_id ? ` #${t.project_id}` : "";
      const blocked = t.blockedBy.length > 0 ? ` (blocked by: ${t.blockedBy.join(", ")})` : "";
      return `[${t.id}] ${t.status} — ${t.subject}${owner}${project}${blocked}`;
    });

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

// ── task_delete ─────────────────────────────────────────────────

server.registerTool(
  "task_delete",
  {description: "Delete a task by ID (removes the folder)",
   inputSchema: {
    taskId: z.number().describe("The task ID to delete"),
  }},
  async ({ taskId }) => {
    const deleted = taskStore.delete(taskId);

    if (!deleted) {
      return {
        content: [{ type: "text" as const, text: `Task ${taskId} not found.` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: `Task ${taskId} deleted.` }],
    };
  },
);

// ── task_move ──────────────────────────────────────────────────

server.registerTool(
  "task_move",
  {
    description: "Move a task to a different project (or to global tasks)",
    inputSchema: {
      taskId: z.number().describe("The task ID to move"),
      project_id: z.string().nullable().optional().describe("Target project key (null for global tasks)"),
    }
  },
  async (params) => {
    try {
      const result = taskMove(taskStore, params.taskId, params.project_id ?? null);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      };
    }
  },
);

// ── task_create_bulk ────────────────────────────────────────────

server.registerTool(
  "task_create_bulk",
  {
    description: "Create multiple tasks at once",
    inputSchema: {
      tasks: z.array(z.object({
        ...taskRecords,
        blockedBy: z.array(z.number()).optional().describe("Task IDs that must complete first"),
      })).describe("Array of task definitions"),
      project_id: z.string().optional().describe("Project key for all tasks (optional)"),
    }
  },
  async (params) => {
    try {
      const result = taskCreateBulk(taskStore, params.tasks, params.project_id);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      };
    }
  },
);

// ── task_tree ───────────────────────────────────────────────────

server.registerTool(
  "task_tree",
  {
    description: "Get task hierarchy tree with all descendants",
    inputSchema: {
      rootId: z.number().optional().describe("Root task ID (if omitted, returns all root tasks)"),
    }
  },
  async (params) => {
    const result = getTaskTree(taskStore, params.rootId);

    if (result.roots.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No tasks found." }],
      };
    }

    const formatted = formatTaskTree(result.roots);

    return {
      content: [{ type: "text" as const, text: formatted + `\n\n(${result.total} total tasks)` }],
    };
  },
);

// ── project_create ──────────────────────────────────────────────

server.registerTool(
  "project_create",
  {
    description: "Create a new project for organizing tasks",
    inputSchema: {
      key: z.string().regex(/^[a-z0-9-]+$/, "Must be kebab-case, no spaces").describe("Unique project identifier"),
      clone: z.boolean().optional().describe("If true, clone repo_url to base_path"),
      ...projectRecords
    },
  },
  async (params) => {
    try {
      const result = await projectCreate(projectStore, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      };
    }
  },
);

// ── project_update ────────────────────────────────────────────────

server.registerTool(
  "project_update",
  {
    description: "Update project",
    inputSchema: {
      key: z.string().min(1).describe("Project key to update"),
      ...projectRecords,
    }
  },
  async (params) => {
    const { key, ...fields } = params
    const project = projectStore.update(key, fields)
    
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project '${key}' not found.` }],
        isError: true,
      }
    }

    if (project.status === "archived") {
      return {
        content: [{ type: "text" as const, text: `Project '${key}' archived.` }]
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(project, null, 2)}]
    }
  }
)

// ── project_list ────────────────────────────────────────────────

server.registerTool(
  "project_list",
  {
    description: "List all projects with optional filtering",
    inputSchema: {
      status: z.enum(["active", "paused", "archived", "all"]).optional().describe("Filter by status"),
      tech_stack: z.array(z.string()).optional().describe("Filter by technologies (match ANY)"),
      search: z.string().optional().describe("Search in key, name, or description"),
      sort: z.enum(["updated", "created", "name"]).optional().describe("Sort field"),
      limit: z.number().optional().describe("Max results (default 100)"),
      offset: z.number().optional().describe("Pagination offset"),
    },
  },
  async (params) => {
    const result = projectList(projectStore, params);

    if (result.projects.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No projects found." }],
      };
    }

    const lines = result.projects.map((p) => {
      const tech = p.tech_stack.length > 0 ? ` [${p.tech_stack.join(", ")}]` : "";
      return `[${p.key}] ${p.status} — ${p.display_name}${tech}`;
    });

    return {
      content: [{ type: "text" as const, text: lines.join("\n") + `\n\n(${result.total} total)` }],
    };
  },
);

// ── project_get ────────────────────────────────────────────────

server.registerTool(
  "project_get",
  {
    description: "Get project information by key",
    inputSchema: {
      key: z.string().describe("Project key to retrieve")
    },
  },
  async(params) => {
    const { key } = params

    const project = projectStore.get(key)
    if (!project) return {
    content: [{ type: "text", text: `Project '${key}' not found.` }],
    isError: true,
    }
    
    return {
      content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
    };
}
)

// ── project_archive ─────────────────────────────────────────────

server.registerTool(
  "project_archive",
  {
    description: "Archive a project (moves to archive/year/)",
    inputSchema: {
      key: z.string().describe("Project key to archive"),
      reason: z.string().optional().describe("Why this project is being archived"),
      force: z.boolean().optional().describe("Skip safety warnings"),
    },
  },
  async (params) => {
    const result = projectArchive(projectStore, params);

    if (!result.project) {
      return {
        content: [{ type: "text" as const, text: `Project "${params.key}" not found.` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: `Project "${params.key}" archived.` }],
    };
  },
);

// ── Start ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[telos] Task server running (${taskStore.count()} tasks in ${config.tasks_root})`);
  console.error(`[telos] Project server ready (${projectStore.count()} projects in ${config.projects_root})`);
}

main().catch((err) => {
  console.error("[telos] Fatal error:", err);
  process.exit(1);
});
