import type { TaskStore } from "../task-store.js";
import type { Task, TaskCreateInput, TaskTreeNode } from "../types.js";

export interface TaskMoveResult {
  task: Task;
  old_project: string | null;
  new_project: string | null;
  warnings?: string[];
}

export interface TaskCreateBulkResult {
  tasks: Task[];
  count: number;
  project_id: string | null;
}

export interface TaskTreeResult {
  roots: TaskTreeNode[];
  total: number;
}

/**
 * Move a task to a different project (or to global tasks)
 */
export function taskMove(
  store: TaskStore,
  taskId: number,
  newProjectId: string | null,
): TaskMoveResult {
  const warnings: string[] = [];

  // Get the task
  const task = store.get(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const oldProjectId = task.project_id;

  if (oldProjectId === newProjectId) {
    warnings.push("Task is already in the target project");
    return {
      task,
      old_project: oldProjectId,
      new_project: newProjectId,
      warnings,
    };
  }

  // Update the task's project_id
  const updated = store.update(taskId, { project_id: newProjectId ?? undefined });
  if (!updated) {
    throw new Error(`Failed to update task ${taskId}`);
  }

  return {
    task: updated,
    old_project: oldProjectId,
    new_project: newProjectId,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Create multiple tasks at once
 */
export function taskCreateBulk(
  store: TaskStore,
  inputs: TaskCreateInput[],
  projectId?: string,
): TaskCreateBulkResult {
  const tasks: Task[] = [];

  for (const input of inputs) {
    const task = store.createTask({
      ...input,
      project_id: projectId ?? input.project_id,
    });
    tasks.push(task);
  }

  return {
    tasks,
    count: tasks.length,
    project_id: projectId ?? null,
  };
}

/**
 * Get task tree with all descendants
 */
export function getTaskTree(
  store: TaskStore,
  rootId?: number,
): TaskTreeResult {
  const allTasks = store.list();
  const taskMap = new Map<number, TaskTreeNode>();

  // Build map of all tasks
  for (const task of allTasks) {
    taskMap.set(task.id, {
      ...task,
      children: [],
      parent_id: task.parent_id ?? null,
    });
  }

  // Build tree structure
  const roots: TaskTreeNode[] = [];

  for (const task of taskMap.values()) {
    if (task.parent_id === null) {
      roots.push(task);
    } else {
      const parent = taskMap.get(task.parent_id);
      if (parent) {
        parent.children.push(task);
      }
    }
  }

  // If rootId specified, return just that subtree
  if (rootId !== undefined) {
    const root = taskMap.get(rootId);
    if (root) {
      return { roots: [root], total: countDescendants(root) + 1 };
    }
    return { roots: [], total: 0 };
  }

  // Sort roots by ID
  roots.sort((a, b) => a.id - b.id);

  return { roots, total: allTasks.length };
}

/**
 * Count all descendants of a task node
 */
function countDescendants(node: TaskTreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countDescendants(child);
  }
  return count;
}

/**
 * Format task tree for display
 */
export function formatTaskTree(
  nodes: TaskTreeNode[],
  indent = 0,
): string {
  const lines: string[] = [];

  for (const node of nodes) {
    const prefix = "  ".repeat(indent);
    const status = node.status;
    const owner = node.owner ? ` @${node.owner}` : "";
    const blocked = node.blockedBy.length > 0 ? " ⛔" : "";
    lines.push(`${prefix}[${node.id}] ${status} — ${node.subject}${owner}${blocked}`);

    if (node.children.length > 0) {
      lines.push(formatTaskTree(node.children, indent + 1));
    }
  }

  return lines.join("\n");
}
