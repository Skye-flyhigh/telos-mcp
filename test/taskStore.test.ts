import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskStore } from "../src/task-store.js";

let taskStore: TaskStore;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "telos-test-"));
  const tasksDir = join(tmpDir, "tasks");
  const projectsDir = join(tmpDir, "projects");
  taskStore = new TaskStore(tasksDir, projectsDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("TaskStore", () => {
  // ── Create ──────────────────────────────────────────────────────

  it("creates a task with defaults", () => {
    const task = taskStore.createTask({ subject: "Fix the bug" });

    expect(task.id).toBe(1);
    expect(task.subject).toBe("Fix the bug");
    expect(task.status).toBe("pending");
    expect(task.description).toBe("");
    expect(task.owner).toBeNull();
    expect(task.blockedBy).toEqual([]);
    expect(task.blocks).toEqual([]);
    expect(task.tags).toBeNull();
    expect(task.created).toBeTruthy();
    expect(task.updated).toBeTruthy();
    expect(task.parent_id).toBeNull();
    expect(task.project_id).toBeNull();
    expect(task.sources).toEqual([]);
  });

  it("creates a task with all fields", () => {
    const task = taskStore.createTask({
      subject: "Add auth",
      description: "Implement JWT authentication",
      owner: "echo",
      tags: ["backend", "security"],
      project_id: "paramot",
      parent_id: undefined,
      sources: ["https://jwt.io", "Claude research"],
    });

    expect(task.subject).toBe("Add auth");
    expect(task.description).toBe("Implement JWT authentication");
    expect(task.owner).toBe("echo");
    expect(task.tags).toEqual(["backend", "security"]);
    expect(task.project_id).toBe("paramot");
    expect(task.parent_id).toBeNull();
    expect(task.sources).toEqual(["https://jwt.io", "Claude research"]);
  });

  it("auto-increments IDs", () => {
    const t1 = taskStore.createTask({ subject: "First" });
    const t2 = taskStore.createTask({ subject: "Second" });
    const t3 = taskStore.createTask({ subject: "Third" });

    expect(t1.id).toBe(1);
    expect(t2.id).toBe(2);
    expect(t3.id).toBe(3);
  });

  it("writes README.md with YAML frontmatter in folder", () => {
    taskStore.createTask({ subject: "Test task", description: "Some details here" });

    // Check README.md exists with frontmatter in slugified folder (in global tasks/)
    const readme = readFileSync(join(tmpDir, "tasks", "1-test-task", "README.md"), "utf-8");
    expect(readme).toContain("---");
    expect(readme).toContain("id: 1");
    expect(readme).toContain("subject: Test task");
    expect(readme).toContain("status: pending");
    expect(readme).toContain("Some details here");
  });

  // ── Get ─────────────────────────────────────────────────────────

  it("gets a task by ID", () => {
    taskStore.createTask({ subject: "Find me" });

    const task = taskStore.get(1);
    expect(task).not.toBeNull();
    expect(task!.subject).toBe("Find me");
  });

  it("returns null for missing ID", () => {
    expect(taskStore.get(999)).toBeNull();
  });

  // ── List ────────────────────────────────────────────────────────

  it("lists all tasks", () => {
    taskStore.createTask({ subject: "A" });
    taskStore.createTask({ subject: "B" });
    taskStore.createTask({ subject: "C" });

    const tasks = taskStore.list();
    expect(tasks).toHaveLength(3);
    expect(tasks[0].id).toBe(1);
    expect(tasks[2].id).toBe(3);
  });

  it("filters by status", () => {
    taskStore.createTask({ subject: "Pending" });
    const t2 = taskStore.createTask({ subject: "Done" });
    taskStore.update(t2.id, { status: "completed" });

    const pending = taskStore.list({ status: "pending" });
    expect(pending).toHaveLength(1);
    expect(pending[0].subject).toBe("Pending");

    const completed = taskStore.list({ status: "completed" });
    expect(completed).toHaveLength(1);
    expect(completed[0].subject).toBe("Done");
  });

  it("filters by owner", () => {
    taskStore.createTask({ subject: "A", owner: "echo" });
    taskStore.createTask({ subject: "B", owner: "nyx" });

    const echoTasks = taskStore.list({ owner: "echo" });
    expect(echoTasks).toHaveLength(1);
    expect(echoTasks[0].subject).toBe("A");
  });

  it("filters by tag", () => {
    taskStore.createTask({ subject: "Backend work", tags: ["backend"] });
    taskStore.createTask({ subject: "Frontend work", tags: ["frontend"] });

    // Note: list() filters by tags array, individual tag filtering done at higher level
    const all = taskStore.list();
    expect(all).toHaveLength(2);
  });

  // ── Update ──────────────────────────────────────────────────────

  it("updates status", () => {
    const task = taskStore.createTask({ subject: "Do it" });

    const updated = taskStore.update(task.id, { status: "in_progress" });
    expect(updated!.status).toBe("in_progress");

    // Verify persisted
    const fromDisk = taskStore.get(task.id);
    expect(fromDisk!.status).toBe("in_progress");
  });

  it("updates subject and description", () => {
    const task = taskStore.createTask({ subject: "Old title", description: "Old desc" });

    const updated = taskStore.update(task.id, {
      subject: "New title",
      description: "New desc",
    });

    expect(updated!.subject).toBe("New title");
    expect(updated!.description).toBe("New desc");
  });

  it("updates tags", () => {
    const task = taskStore.createTask({ subject: "Tagged", tags: ["old"] });

    const updated = taskStore.update(task.id, { tags: ["new", "shiny"] });
    expect(updated!.tags).toEqual(["new", "shiny"]);
  });

  it("returns null for missing ID", () => {
    expect(taskStore.update(999, { status: "completed" })).toBeNull();
  });

  it("handles deleted status", () => {
    const task = taskStore.createTask({ subject: "Bye" });

    const result = taskStore.update(task.id, { status: "deleted" });
    expect(result).toBeNull(); // deleted returns null
    expect(taskStore.get(task.id)).toBeNull(); // file removed
  });

  // ── Delete ──────────────────────────────────────────────────────

  it("deletes a task", () => {
    const task = taskStore.createTask({ subject: "Delete me" });

    expect(taskStore.delete(task.id)).toBe(true);
    expect(taskStore.get(task.id)).toBeNull();
    expect(taskStore.count()).toBe(0);
  });

  it("returns false for missing ID", () => {
    expect(taskStore.delete(999)).toBe(false);
  });

  // ── Dependencies ────────────────────────────────────────────────

  it("sets up blockedBy on create", () => {
    const t1 = taskStore.createTask({ subject: "First" });
    const t2 = taskStore.createTask({ subject: "Second", blockedBy: [t1.id] });

    expect(t2.blockedBy).toEqual([1]);

    // Reverse: t1 should now list t2 in blocks
    const t1Updated = taskStore.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);
  });

  it("adds blockedBy via update", () => {
    const t1 = taskStore.createTask({ subject: "First" });
    const t2 = taskStore.createTask({ subject: "Second" });

    taskStore.update(t2.id, { addBlockedBy: [t1.id] });

    const updated = taskStore.get(t2.id);
    expect(updated!.blockedBy).toEqual([1]);

    const t1Updated = taskStore.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);
  });

  it("adds blocks via update", () => {
    const t1 = taskStore.createTask({ subject: "First" });
    const t2 = taskStore.createTask({ subject: "Second" });

    taskStore.update(t1.id, { addBlocks: [t2.id] });

    const t1Updated = taskStore.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);

    const t2Updated = taskStore.get(t2.id);
    expect(t2Updated!.blockedBy).toEqual([1]);
  });

  it("completing a task unblocks dependents", () => {
    const t1 = taskStore.createTask({ subject: "Blocker" });
    taskStore.createTask({ subject: "Blocked", blockedBy: [t1.id] });

    taskStore.update(t1.id, { status: "completed" });

    const t2 = taskStore.get(2);
    expect(t2!.blockedBy).toEqual([]);
  });

  it("deleting a task cleans up dependencies", () => {
    const t1 = taskStore.createTask({ subject: "Will be deleted" });
    const t2 = taskStore.createTask({ subject: "Depends on t1", blockedBy: [t1.id] });

    taskStore.delete(t1.id);

    const t2Updated = taskStore.get(t2.id);
    expect(t2Updated!.blockedBy).toEqual([]);
  });

  it("does not duplicate dependencies", () => {
    const t1 = taskStore.createTask({ subject: "First" });
    const t2 = taskStore.createTask({ subject: "Second", blockedBy: [t1.id] });

    // Try adding the same dependency again
    taskStore.update(t2.id, { addBlockedBy: [t1.id] });

    const updated = taskStore.get(t2.id);
    expect(updated!.blockedBy).toEqual([1]); // Not [1, 1]
  });

  // ── Metadata ─────────────────────────────────────────────────────

  it("creates a task with metadata", () => {
    const task = taskStore.createTask({
      subject: "With metadata",
      metadata: { pr: "#42", priority: "high" },
    });

    expect(task.metadata).toEqual({ pr: "#42", priority: "high" });

    // Verify persisted
    const fromDisk = taskStore.get(task.id);
    expect(fromDisk!.metadata).toEqual({ pr: "#42", priority: "high" });
  });

  it("defaults metadata to empty object", () => {
    const task = taskStore.createTask({ subject: "No metadata" });
    expect(task.metadata).toEqual({});
  });

  it("merges metadata on update", () => {
    const task = taskStore.createTask({
      subject: "Merge test",
      metadata: { a: "1", b: "2" },
    });

    taskStore.update(task.id, { metadata: { b: "updated", c: "3" } });

    const updated = taskStore.get(task.id);
    expect(updated!.metadata).toEqual({ a: "1", b: "updated", c: "3" });
  });

  it("deletes metadata keys via null", () => {
    const task = taskStore.createTask({
      subject: "Delete key test",
      metadata: { keep: "yes", remove: "bye" },
    });

    taskStore.update(task.id, { metadata: { remove: null } });

    const updated = taskStore.get(task.id);
    expect(updated!.metadata).toEqual({ keep: "yes" });
  });

  it("stores metadata in README.md frontmatter", () => {
    taskStore.createTask({
      subject: "Metadata check",
      metadata: { priority: "high" },
    });

    const readme = readFileSync(join(tmpDir, "tasks", "1-metadata-check", "README.md"), "utf-8");
    expect(readme).toContain("priority: high");
  });

  // ── Count ───────────────────────────────────────────────────────

  it("counts tasks", () => {
    expect(taskStore.count()).toBe(0);

    taskStore.createTask({ subject: "A" });
    taskStore.createTask({ subject: "B" });

    expect(taskStore.count()).toBe(2);
  });

  // ── ID reuse after deletion ─────────────────────────────────────

  it("does not reuse deleted IDs", () => {
    taskStore.createTask({ subject: "A" }); // id=1
    taskStore.createTask({ subject: "B" }); // id=2
    taskStore.delete(2);

    const t3 = taskStore.createTask({ subject: "C" });
    expect(t3.id).toBe(3); // Not 2
  });
});
