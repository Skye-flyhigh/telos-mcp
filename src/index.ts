#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { TaskStore } from "./store.js";
import { loadConfig } from "./types.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));
const config = loadConfig();
const store = new TaskStore(config.dir);

const server = new McpServer({
  name: "telos-mcp",
  version: pkg.version,
});

const descriptionStructure: string = `
Structured description, details points when applicable:
- Context: explain the why, and overall view how to solve the problem
- Task details
- Task location: where the task takes place
- Architecture: final structure of the expected output
- Dependencies: explain what are required for delivery
- Examples of the deliverable and expectations
- Reasoning for the offered solution
- Foreseen barriers and solution (from task context)
- Implementation steps: real, commitable implementation steps, questions to ask the user for clarification and decision
- Testing plan
- Deployment plan
`

// ── task_create ─────────────────────────────────────────────────

server.registerTool(
  "task_create",
  {
    description: "Create a new task for tracking work",
    inputSchema: {
      subject: z.string().describe("Brief imperative title (e.g. 'Fix auth bug')"),
      description: z.string().optional().describe(`Detailed markdown description. \n ${descriptionStructure}`),
      activeForm: z
        .string()
        .optional()
        .describe("Present-continuous form shown in spinner when task is in_progress. Subject is imperative ('Fix auth bug'), activeForm is what's happening now ('Fixing auth bug'). Displayed as: ⠋ Fixing auth bug..."),
      owner: z.string().optional().describe("Who owns this task"),
      blockedBy: z.array(z.number()).optional().describe("Task IDs that must complete first"),
      tags: z.array(z.string()).optional().describe("Categorization tags"),
      metadata: z.record(z.string()).optional().describe("Arbitrary key-value pairs (e.g. { sources: 'https://...', pr: '#42' })"),
    }
  },
  async (params) => {
    const task = store.create(params);
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
      status: z
        .enum(["pending", "in_progress", "completed", "deleted"])
        .optional()
        .describe("New status (deleted removes the task)"),
      subject: z.string().optional().describe("New subject"),
      description: z.string().optional().describe(`New description with structure: \n ${descriptionStructure}`),
      activeForm: z.string().optional().describe("New spinner text"),
      owner: z.string().optional().describe("New owner"),
      addBlockedBy: z.array(z.number()).optional().describe("Task IDs to add as blockers"),
      addBlocks: z.array(z.number()).optional().describe("Task IDs that this task blocks"),
      tags: z.array(z.string()).optional().describe("Replace tags"),
      metadata: z.record(z.string().nullable()).optional().describe("Merge metadata keys into the task. Set a key to null to delete it."),
    }
  },
  async (params) => {
    const { taskId, ...fields } = params;
    const task = store.update(taskId, fields);

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
    const task = store.get(taskId);

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
    status: z
      .enum(["pending", "in_progress", "completed"])
      .optional()
      .describe("Filter by status"),
    owner: z.string().optional().describe("Filter by owner"),
    tag: z.string().optional().describe("Filter by tag"),
  }},
  async (params) => {
    const tasks = store.list(params);

    if (tasks.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No tasks found." }],
      };
    }

    const lines = tasks.map((t) => {
      const owner = t.owner ? ` @${t.owner}` : "";
      const tags = t.tags.length > 0 ? ` ${t.tags.map((tag) => `#${tag}`).join(" ")}` : "";
      const blocked = t.blockedBy.length > 0 ? ` (blocked by: ${t.blockedBy.join(", ")})` : "";
      return `[${t.id}] ${t.status} — ${t.subject}${owner}${tags}${blocked}`;
    });

    return {
      content: [{ type: "text" as const, text: lines.join("\n") }],
    };
  },
);

// ── task_delete ─────────────────────────────────────────────────

server.registerTool(
  "task_delete",
  {description: "Delete a task by ID (removes the file)",
   inputSchema: {
    taskId: z.number().describe("The task ID to delete"),
  }},
  async ({ taskId }) => {
    const deleted = store.delete(taskId);

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

// ── Start ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[telos] Task server running on stdio (${store.count()} tasks in ${config.dir})`);
}

main().catch((err) => {
  console.error("[telos] Fatal error:", err);
  process.exit(1);
});
