import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Task, TaskSummary, TaskStatus, ListFilters } from "./types.js";
import { VALID_STATUSES } from "./types.js";
import { parseFrontmatter, serializeFrontmatter, isoNow, slugify } from "./utils.js";

export class TaskStore {
  private dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
  }

  create(fields: {
    subject: string;
    description?: string;
    activeForm?: string;
    owner?: string;
    blockedBy?: number[];
    tags?: string[];
    metadata?: Record<string, string>;
  }): Task {
    const now = isoNow();
    const id = this.nextId();

    const task: Task = {
      id,
      subject: fields.subject,
      description: fields.description ?? "",
      status: "pending",
      created: now,
      updated: now,
      owner: fields.owner ?? "",
      activeForm: fields.activeForm ?? "",
      blockedBy: fields.blockedBy ?? [],
      blocks: [],
      tags: fields.tags ?? [],
      metadata: fields.metadata ?? {},
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
    const path = this.findTaskFile(id);
    if (!path) return null;
    return this.readTask(path);
  }

  list(filters?: ListFilters): TaskSummary[] {
    const files = this.taskFiles();
    const results: TaskSummary[] = [];

    for (const file of files) {
      const task = this.readTask(join(this.dir, file));

      if (filters?.status && task.status !== filters.status) continue;
      if (filters?.owner && task.owner !== filters.owner) continue;
      if (filters?.tag && !task.tags.includes(filters.tag)) continue;

      results.push({
        id: task.id,
        subject: task.subject,
        status: task.status,
        owner: task.owner,
        blockedBy: task.blockedBy,
        tags: task.tags,
      });
    }

    return results.sort((a, b) => a.id - b.id);
  }

  update(
    id: number,
    fields: {
      status?: TaskStatus | "deleted";
      subject?: string;
      description?: string;
      activeForm?: string;
      owner?: string;
      addBlockedBy?: number[];
      addBlocks?: number[];
      tags?: string[];
      metadata?: Record<string, string | null>;
    },
  ): Task | null {
    // Handle delete via status
    if (fields.status === "deleted") {
      this.delete(id);
      return null;
    }

    const oldPath = this.findTaskFile(id);
    if (!oldPath) return null;
    const task = this.readTask(oldPath);

    const now = isoNow();

    if (fields.status && VALID_STATUSES.includes(fields.status)) {
      task.status = fields.status;
    }
    if (fields.subject !== undefined) task.subject = fields.subject;
    if (fields.description !== undefined) task.description = fields.description;
    if (fields.activeForm !== undefined) task.activeForm = fields.activeForm;
    if (fields.owner !== undefined) task.owner = fields.owner;
    if (fields.tags !== undefined) task.tags = fields.tags;

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
    if (fields.addBlockedBy) {
      for (const blockerId of fields.addBlockedBy) {
        if (!task.blockedBy.includes(blockerId)) {
          task.blockedBy.push(blockerId);
          // Update reverse: add this task to blocker's `blocks`
          const blocker = this.get(blockerId);
          if (blocker && !blocker.blocks.includes(id)) {
            blocker.blocks.push(id);
            blocker.updated = now;
            this.writeTask(blocker);
          }
        }
      }
    }

    // Add tasks that this one blocks
    if (fields.addBlocks) {
      for (const blockedId of fields.addBlocks) {
        if (!task.blocks.includes(blockedId)) {
          task.blocks.push(blockedId);
          // Update reverse: add this task to blocked's `blockedBy`
          const blocked = this.get(blockedId);
          if (blocked && !blocked.blockedBy.includes(id)) {
            blocked.blockedBy.push(id);
            blocked.updated = now;
            this.writeTask(blocked);
          }
        }
      }
    }

    // When completing, unblock dependents
    if (fields.status === "completed") {
      this.unblockDependents(id, now);
    }

    task.updated = now;

    // Delete old file if path changed (subject change or pre-slug migration)
    const newPath = this.taskPath(task.id, task.subject);
    if (oldPath !== newPath) {
      unlinkSync(oldPath);
    }

    this.writeTask(task);
    return task;
  }

  delete(id: number): boolean {
    const path = this.findTaskFile(id);
    if (!path) return false;

    // Clean up dependencies before removing
    this.unblockDependents(id, isoNow());
    this.removeFromBlockers(id, isoNow());

    unlinkSync(path);
    return true;
  }

  count(): number {
    return this.taskFiles().length;
  }

  // ── Private ────────────────────────────────────────────────────

  private nextId(): number {
    const counterPath = join(this.dir, ".next_id");
    let nextId = 1;

    if (existsSync(counterPath)) {
      const stored = parseInt(readFileSync(counterPath, "utf-8").trim(), 10);
      if (!Number.isNaN(stored)) nextId = stored;
    }

    // Also check existing files in case counter is stale
    const files = this.taskFiles();
    if (files.length > 0) {
      const maxExisting = Math.max(
        ...files.map((f) => parseInt(f.split("-")[0], 10)).filter((n) => !Number.isNaN(n)),
      );
      if (maxExisting >= nextId) nextId = maxExisting + 1;
    }

    writeFileSync(counterPath, String(nextId + 1), "utf-8");
    return nextId;
  }

  private taskPath(id: number, subject: string): string {
    const slug = slugify(subject);
    return join(this.dir, slug ? `${id}-${slug}.md` : `${id}.md`);
  }

  /** Find a task file by ID prefix (handles slug changes) */
  private findTaskFile(id: number): string | null {
    const files = this.taskFiles();
    const match = files.find((f) => {
      const fileId = parseInt(f.split("-")[0], 10);
      return fileId === id;
    });
    return match ? join(this.dir, match) : null;
  }

  private taskFiles(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir).filter((f) => /^\d+(-[a-z0-9-]+)?\.md$/.test(f));
  }

  private readTask(path: string): Task {
    const raw = readFileSync(path, "utf-8");
    const { data, body } = parseFrontmatter(raw);

    return {
      id: data.id as number,
      subject: (data.subject as string) ?? "",
      description: body,
      status: (data.status as TaskStatus) ?? "pending",
      created: (data.created as string) ?? "",
      updated: (data.updated as string) ?? "",
      owner: (data.owner as string) ?? "",
      activeForm: (data.activeForm as string) ?? "",
      blockedBy: (data.blockedBy as number[]) ?? [],
      blocks: (data.blocks as number[]) ?? [],
      tags: (data.tags as string[]) ?? [],
      metadata: (data.metadata as Record<string, string>) ?? {},
    };
  }

  private writeTask(task: Task): void {
    const data: Record<string, unknown> = {
      id: task.id,
      subject: task.subject,
      status: task.status,
      created: task.created,
      updated: task.updated,
      owner: task.owner,
      activeForm: task.activeForm,
      blockedBy: task.blockedBy,
      blocks: task.blocks,
      tags: task.tags,
      metadata: task.metadata,
    };

    const content = serializeFrontmatter(data, task.description);
    writeFileSync(this.taskPath(task.id, task.subject), content, "utf-8");
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
}
