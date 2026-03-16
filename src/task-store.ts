import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Task, TaskStatus, TaskSummary } from "./types.js";
import { VALID_TASK_STATUSES } from "./types.js";
import { isoNow, parseFrontmatter, serializeFrontmatter } from "./utils.js";

export class TaskStore {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  createTask(fields: {
    subject: string;
    description?: string;
    owner?: string;
    blockedBy?: number[];
    project_id?: string;
    parent_id?: number;
    tags?: string[];
    metadata?: Record<string, string>;
    sources?: string[];
  }): Task {
    const now = isoNow();
    const id = this.nextId();

    // Compute depth from parent
    let depth = 0;
    if (fields.parent_id) {
      const parent = this.get(fields.parent_id);
      depth = parent ? parent.depth + 1 : 0;
    }

    const task: Task = {
      id,
      project_id: fields.project_id ?? null,
      subject: fields.subject,
      description: fields.description ?? "",
      status: "pending",
      owner: fields.owner ?? null,
      created: now,
      updated: now,
      blockedBy: fields.blockedBy ?? [],
      blocks: [],
      tags: fields.tags ?? null,
      metadata: fields.metadata ?? {},
      parent_id: fields.parent_id ?? null,
      context_capture: null,
      depth,
      sources: fields.sources ?? [],
    };

    // Update reverse dependencies: add this task to each blocker's `blocks`
    for (const blockerId of task.blockedBy) {
      const blocker = this.get(blockerId);
      if (blocker && !blocker.blocks.includes(id)) {
        blocker.blocks.push(id);
        blocker.updated = now;
        this.writeTask(blocker);
      }
    }

    this.writeTask(task);
    return task;
  }

  get(id: number): Task | null {
    const taskDir = join(this.dir, String(id));
    if (!existsSync(taskDir)) return null;
    return this.readTask(taskDir);
  }

  list(filters?: {
    status?: TaskStatus;
    owner?: string;
    project_id?: string;
    parent_id?: number | null;
  }): TaskSummary[] {
    const results: TaskSummary[] = [];
    const taskDirs = this.taskDirs();

    for (const dir of taskDirs) {
      const task = this.readTask(join(this.dir, dir));

      if (filters?.status && task.status !== filters.status) continue;
      if (filters?.owner && task.owner !== filters.owner) continue;
      if (filters?.project_id && task.project_id !== filters.project_id) continue;
      if (filters?.parent_id !== undefined && task.parent_id !== filters.parent_id) continue;

      results.push({
        id: task.id,
        project_id: task.project_id,
        subject: task.subject,
        status: task.status,
        owner: task.owner,
        blockedBy: task.blockedBy,
        tags: task.tags,
        depth: task.depth,
      });
    }

    return results.sort((a, b) => a.id - b.id);
  }

  update(
    id: number,
    fields: {
      project_id?: string;
      parent_id?: number;
      status?: TaskStatus | "deleted";
      subject?: string;
      description?: string;
      owner?: string;
      addBlockedBy?: number[];
      addBlocks?: number[];
      tags?: string[];
      metadata?: Record<string, string | null>;
      sources?: string[];
    },
  ): Task | null {
    // Handle delete via status
    if (fields.status === "deleted") {
      this.delete(id);
      return null;
    }

    const taskDir = join(this.dir, String(id));
    if (!existsSync(taskDir)) return null;
    const task = this.readTask(taskDir);

    const now = isoNow();

    if (fields.status && VALID_TASK_STATUSES.includes(fields.status)) {
      task.status = fields.status;
    }

    if (fields.subject !== undefined) task.subject = fields.subject;
    if (fields.description !== undefined) task.description = fields.description;
    if (fields.owner !== undefined) task.owner = fields.owner ?? null;
    if (fields.tags !== undefined) task.tags = fields.tags ?? null;
    if (fields.project_id !== undefined) task.project_id = fields.project_id ?? null;
    if (fields.sources !== undefined) task.sources = fields.sources ?? [];

    if(fields.parent_id !== undefined) this.updateParent(task, fields.parent_id, now)

    // Merge metadata (null values delete keys)
    if (fields.metadata) {
      for (const [key, val] of Object.entries(fields.metadata)) {
        if (val === null) {
          delete task.metadata[key];
        } else {
          task.metadata[key] = val;
        }
      }
    }

    // Add blocking dependencies
    if (fields.addBlockedBy) this.blockDependents(task, fields.addBlockedBy, now)

    // Add tasks that this one blocks
    if (fields.addBlocks) this.addBlockers(task, fields.addBlocks, now)

    // When completing, unblock dependents
    if (fields.status === "completed") {
      this.unblockDependents(id, now);
    }

    task.updated = now;
    this.writeTask(task);
    return task;
  }

  delete(id: number): boolean {
    const taskDir = join(this.dir, String(id));
    if (!existsSync(taskDir)) return false;

    // Clean up dependencies before removing
    this.unblockDependents(id, isoNow());
    this.removeFromBlockers(id, isoNow());

    rmSync(taskDir, { recursive: true, force: true });
    return true;
  }

  count(): number {
    return this.taskDirs().length;
  }

  // ── Private ────────────────────────────────────────────────────

  private nextId(): number {
    const counterPath = join(this.dir, ".next_id");
    let nextId = 1;

    if (existsSync(counterPath)) {
      const stored = parseInt(readFileSync(counterPath, "utf-8").trim(), 10);
      if (!Number.isNaN(stored)) nextId = stored;
    }

    // Also check existing directories
    const dirs = this.taskDirs();
    if (dirs.length > 0) {
      const maxExisting = Math.max(
        ...dirs.map((d) => parseInt(d, 10)).filter((n) => !Number.isNaN(n)),
      );
      if (maxExisting >= nextId) nextId = maxExisting + 1;
    }

    writeFileSync(counterPath, String(nextId + 1), "utf-8");
    return nextId;
  }

  private taskDirs(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
      .map((d) => d.name)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  }

  private readTask(taskDir: string): Task {
    const readmePath = join(taskDir, "README.md");

    const raw = readFileSync(readmePath, "utf-8");
    const { data, body } = parseFrontmatter(raw);

    return {
      id: data.id as number,
      project_id: (data.project_id as string) ?? null,
      subject: (data.subject as string) ?? "",
      description: body,
      status: (data.status as TaskStatus) ?? "pending",
      owner: (data.owner as string) ?? null,
      created: (data.created as string) ?? "",
      updated: (data.updated as string) ?? "",
      blockedBy: (data.blockedBy as number[]) ?? [],
      blocks: (data.blocks as number[]) ?? [],
      tags: (data.tags as string[]) ?? null,
      metadata: (data.metadata as Record<string, string>) ?? {},
      parent_id: (data.parent_id as number) ?? null,
      context_capture: (data.context_capture as Task["context_capture"]) ?? null,
      depth: (data.depth as number) ?? 0,
      sources: (data.sources as string[]) ?? [],
    };
  }

  private writeTask(task: Task): void {
    const taskDir = join(this.dir, String(task.id));
    mkdirSync(taskDir, { recursive: true });

    const readmePath = join(taskDir, "README.md");

    // Build YAML frontmatter for Obsidian compatibility
    const data: Record<string, unknown> = {
      id: task.id,
      project_id: task.project_id,
      subject: task.subject,
      status: task.status,
      created: task.created,
      updated: task.updated,
      owner: task.owner,
      blockedBy: task.blockedBy,
      blocks: task.blocks,
      parent_id: task.parent_id,
      depth: task.depth,
    };

    // Only include optional fields if they exist
    if (task.metadata && Object.keys(task.metadata).length > 0) {
      data.metadata = task.metadata;
    }
    if (task.context_capture) {
      data.context_capture = task.context_capture;
    }
    if (task.sources && task.sources.length > 0) {
      data.sources = task.sources;
    }
    if (task.tags && task.tags.length > 0) {
      data.tags = task.tags;
    }

    const frontmatter = serializeFrontmatter(data, task.description ?? "");
    writeFileSync(readmePath, frontmatter, "utf-8");
  }

  /**
   * Add blocking dependencies to the task
   * @param task 
   * @param addBlockedBy 
   * @param now 
   */
  private blockDependents(task: Task, addBlockedBy: number[], now: string): void {
      for (const blockerId of addBlockedBy) {
        if (!task.blockedBy.includes(blockerId)) {
          task.blockedBy.push(blockerId);
          // Update reverse: add this task to blocker's `blocks`
          const blocker = this.get(blockerId);
          if (blocker && !blocker.blocks.includes(task.id)) {
            blocker.blocks.push(task.id);
            blocker.updated = now;
            this.writeTask(blocker);
          }
        }
      }
  }

  /** Remove this task's ID from all dependents' blockedBy arrays */
  private unblockDependents(id: number, now: string): void {
    const task = this.get(id);
    if (!task) return;

    for (const blockedId of task.blocks) {
      const blocked = this.get(blockedId);
      if (blocked) {
        blocked.blockedBy = blocked.blockedBy.filter((bid) => bid !== id);
        blocked.updated = now;
        this.writeTask(blocked);
      }
    }
  }

  /**
   * Add this task to the blockers' blocks arrays
   * @param task 
   * @param addBlocks 
   * @param now 
   */
  private addBlockers(task: Task, addBlocks: number[], now: string): void {
          for (const blockedId of addBlocks) {
        if (!task.blocks.includes(blockedId)) {
          task.blocks.push(blockedId);
          // Update reverse: add this task to blocked's `blockedBy`
          const blocked = this.get(blockedId);
          if (blocked && !blocked.blockedBy.includes(task.id)) {
            blocked.blockedBy.push(task.id);
            blocked.updated = now;
            this.writeTask(blocked);
          }
        }
      }
  }

  /** Remove this task's ID from all blockers' blocks arrays */
  private removeFromBlockers(id: number, now: string): void {
    const task = this.get(id);
    if (!task) return;

    for (const blockerId of task.blockedBy) {
      const blocker = this.get(blockerId);
      if (blocker) {
        blocker.blocks = blocker.blocks.filter((bid) => bid !== id);
        blocker.updated = now;
        this.writeTask(blocker);
      }
    }
  }

  private updateParent(task: Task, newParentId: number | null, now: string): void {
    if (task.parent_id === newParentId) return;

    // Validate: prevent setting self as parent
    if (newParentId === task.id) {
      throw new Error(`Task ${task.id} cannot be its own parent`);
    }

    // Validate: prevent cycles - new parent must not be a descendant of this task
    if (newParentId !== null) {
      const newParent = this.get(newParentId);
      if (!newParent) {
        throw new Error(`Parent task ${newParentId} not found`);
      }

      // Check if new parent is a descendant of this task (would create cycle)
      if (this.isDescendant(task.id, newParentId)) {
        throw new Error(`Cannot set task ${newParentId} as parent - it is a descendant of ${task.id}`);
      }

      // Validate depth limit (max 5)
      if (newParent.depth >= 4) {
        throw new Error(`Cannot set parent - would exceed maximum depth of 5`);
      }

      // Update old parent: remove this task from old parent's blocks if it was there
      if (task.parent_id !== null) {
        const oldParent = this.get(task.parent_id);
        if (oldParent) {
          // Note: parent-child is not a blocking relationship, so no blocks update needed
          oldParent.updated = now;
          this.writeTask(oldParent);
        }
      }

      // Update new parent
      newParent.updated = now;
      this.writeTask(newParent);

      // Update task with new parent and depth
      task.parent_id = newParentId;
      task.depth = newParent.depth + 1;
    } else {
      // Removing parent (making it a root task)
      if (task.parent_id !== null) {
        const oldParent = this.get(task.parent_id);
        if (oldParent) {
          oldParent.updated = now;
          this.writeTask(oldParent);
        }
      }
      task.parent_id = null;
      task.depth = 0;
    }

    // Recursively update all descendants' depth
    this.updateDescendantsDepth(task.id, task.depth, now);
  }

  /** Check if potentialDescendant is actually a descendant of ancestorId */
  private isDescendant(ancestorId: number, potentialDescendant: number): boolean {
    const task = this.get(potentialDescendant);
    if (!task) return false;
    if (task.parent_id === null) return false;
    if (task.parent_id === ancestorId) return true;
    return this.isDescendant(ancestorId, task.parent_id);
  }

  /** Recursively update depth of all descendants */
  private updateDescendantsDepth(parentId: number, parentDepth: number, now: string): void {
    const children = this.list({ parent_id: parentId });
    for (const child of children) {
      const childTask = this.get(child.id);
      if (childTask) {
        childTask.depth = parentDepth + 1;
        childTask.updated = now;
        this.writeTask(childTask);
        // Recursively update this child's descendants
        this.updateDescendantsDepth(child.id, childTask.depth, now);
      }
    }
  }
}
