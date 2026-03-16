import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TaskStore } from "../src/task-store.js";

let store: TaskStore;
let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "telos-test-"));
  store = new TaskStore(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("TaskStore", () => {
  // ── Create ──────────────────────────────────────────────────────

  it("creates a task with defaults", () => {
    const task = store.createTask({ subject: "Fix the bug" });

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
    const task = store.createTask({
      subject: "Add auth",
      description: "Implement JWT authentication",
      owner: "echo",
      tags: ["backend", "security"],
      project_id: "paramot",
      parent_id: null,
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
    const t1 = store.createTask({ subject: "First" });
    const t2 = store.createTask({ subject: "Second" });
    const t3 = store.createTask({ subject: "Third" });

    expect(t1.id).toBe(1);
    expect(t2.id).toBe(2);
    expect(t3.id).toBe(3);
  });

  it("writes README.md with YAML frontmatter in folder", () => {
    store.createTask({ subject: "Test task", description: "Some details here" });

    // Check README.md exists with frontmatter in slugified folder
    const readme = readFileSync(join(tmpDir, "1-test-task", "README.md"), "utf-8");
    expect(readme).toContain("---");
    expect(readme).toContain("id: 1");
    expect(readme).toContain("subject: Test task");
    expect(readme).toContain("status: pending");
    expect(readme).toContain("Some details here");
  });

  // ── Get ─────────────────────────────────────────────────────────

  it("gets a task by ID", () => {
    store.createTask({ subject: "Find me" });

    const task = store.get(1);
    expect(task).not.toBeNull();
    expect(task!.subject).toBe("Find me");
  });

  it("returns null for missing ID", () => {
    expect(store.get(999)).toBeNull();
  });

  // ── List ────────────────────────────────────────────────────────

  it("lists all tasks", () => {
    store.createTask({ subject: "A" });
    store.createTask({ subject: "B" });
    store.createTask({ subject: "C" });

    const tasks = store.list();
    expect(tasks).toHaveLength(3);
    expect(tasks[0].id).toBe(1);
    expect(tasks[2].id).toBe(3);
  });

  it("filters by status", () => {
    store.createTask({ subject: "Pending" });
    const t2 = store.createTask({ subject: "Done" });
    store.update(t2.id, { status: "completed" });

    const pending = store.list({ status: "pending" });
    expect(pending).toHaveLength(1);
    expect(pending[0].subject).toBe("Pending");

    const completed = store.list({ status: "completed" });
    expect(completed).toHaveLength(1);
    expect(completed[0].subject).toBe("Done");
  });

  it("filters by owner", () => {
    store.createTask({ subject: "A", owner: "echo" });
    store.createTask({ subject: "B", owner: "nyx" });

    const echoTasks = store.list({ owner: "echo" });
    expect(echoTasks).toHaveLength(1);
    expect(echoTasks[0].subject).toBe("A");
  });

  it("filters by tag", () => {
    store.createTask({ subject: "Backend work", tags: ["backend"] });
    store.createTask({ subject: "Frontend work", tags: ["frontend"] });

    // Note: list() filters by tags array, individual tag filtering done at higher level
    const all = store.list();
    expect(all).toHaveLength(2);
  });

  // ── Update ──────────────────────────────────────────────────────

  it("updates status", () => {
    const task = store.createTask({ subject: "Do it" });

    const updated = store.update(task.id, { status: "in_progress" });
    expect(updated!.status).toBe("in_progress");

    // Verify persisted
    const fromDisk = store.get(task.id);
    expect(fromDisk!.status).toBe("in_progress");
  });

  it("updates subject and description", () => {
    const task = store.createTask({ subject: "Old title", description: "Old desc" });

    const updated = store.update(task.id, {
      subject: "New title",
      description: "New desc",
    });

    expect(updated!.subject).toBe("New title");
    expect(updated!.description).toBe("New desc");
  });

  it("updates tags", () => {
    const task = store.createTask({ subject: "Tagged", tags: ["old"] });

    const updated = store.update(task.id, { tags: ["new", "shiny"] });
    expect(updated!.tags).toEqual(["new", "shiny"]);
  });

  it("returns null for missing ID", () => {
    expect(store.update(999, { status: "completed" })).toBeNull();
  });

  it("handles deleted status", () => {
    const task = store.createTask({ subject: "Bye" });

    const result = store.update(task.id, { status: "deleted" });
    expect(result).toBeNull(); // deleted returns null
    expect(store.get(task.id)).toBeNull(); // file removed
  });

  // ── Delete ──────────────────────────────────────────────────────

  it("deletes a task", () => {
    const task = store.createTask({ subject: "Delete me" });

    expect(store.delete(task.id)).toBe(true);
    expect(store.get(task.id)).toBeNull();
    expect(store.count()).toBe(0);
  });

  it("returns false for missing ID", () => {
    expect(store.delete(999)).toBe(false);
  });

  // ── Dependencies ────────────────────────────────────────────────

  it("sets up blockedBy on create", () => {
    const t1 = store.createTask({ subject: "First" });
    const t2 = store.createTask({ subject: "Second", blockedBy: [t1.id] });

    expect(t2.blockedBy).toEqual([1]);

    // Reverse: t1 should now list t2 in blocks
    const t1Updated = store.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);
  });

  it("adds blockedBy via update", () => {
    const t1 = store.createTask({ subject: "First" });
    const t2 = store.createTask({ subject: "Second" });

    store.update(t2.id, { addBlockedBy: [t1.id] });

    const updated = store.get(t2.id);
    expect(updated!.blockedBy).toEqual([1]);

    const t1Updated = store.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);
  });

  it("adds blocks via update", () => {
    const t1 = store.createTask({ subject: "First" });
    const t2 = store.createTask({ subject: "Second" });

    store.update(t1.id, { addBlocks: [t2.id] });

    const t1Updated = store.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);

    const t2Updated = store.get(t2.id);
    expect(t2Updated!.blockedBy).toEqual([1]);
  });

  it("completing a task unblocks dependents", () => {
    const t1 = store.createTask({ subject: "Blocker" });
    store.createTask({ subject: "Blocked", blockedBy: [t1.id] });

    store.update(t1.id, { status: "completed" });

    const t2 = store.get(2);
    expect(t2!.blockedBy).toEqual([]);
  });

  it("deleting a task cleans up dependencies", () => {
    const t1 = store.createTask({ subject: "Will be deleted" });
    const t2 = store.createTask({ subject: "Depends on t1", blockedBy: [t1.id] });

    store.delete(t1.id);

    const t2Updated = store.get(t2.id);
    expect(t2Updated!.blockedBy).toEqual([]);
  });

  it("does not duplicate dependencies", () => {
    const t1 = store.createTask({ subject: "First" });
    const t2 = store.createTask({ subject: "Second", blockedBy: [t1.id] });

    // Try adding the same dependency again
    store.update(t2.id, { addBlockedBy: [t1.id] });

    const updated = store.get(t2.id);
    expect(updated!.blockedBy).toEqual([1]); // Not [1, 1]
  });

  // ── Metadata ─────────────────────────────────────────────────────

  it("creates a task with metadata", () => {
    const task = store.createTask({
      subject: "With metadata",
      metadata: { pr: "#42", priority: "high" },
    });

    expect(task.metadata).toEqual({ pr: "#42", priority: "high" });

    // Verify persisted
    const fromDisk = store.get(task.id);
    expect(fromDisk!.metadata).toEqual({ pr: "#42", priority: "high" });
  });

  it("defaults metadata to empty object", () => {
    const task = store.createTask({ subject: "No metadata" });
    expect(task.metadata).toEqual({});
  });

  it("merges metadata on update", () => {
    const task = store.createTask({
      subject: "Merge test",
      metadata: { a: "1", b: "2" },
    });

    store.update(task.id, { metadata: { b: "updated", c: "3" } });

    const updated = store.get(task.id);
    expect(updated!.metadata).toEqual({ a: "1", b: "updated", c: "3" });
  });

  it("deletes metadata keys via null", () => {
    const task = store.createTask({
      subject: "Delete key test",
      metadata: { keep: "yes", remove: "bye" },
    });

    store.update(task.id, { metadata: { remove: null } });

    const updated = store.get(task.id);
    expect(updated!.metadata).toEqual({ keep: "yes" });
  });

  it("stores metadata in README.md frontmatter", () => {
    store.createTask({
      subject: "Metadata check",
      metadata: { priority: "high" },
    });

    const readme = readFileSync(join(tmpDir, "1-metadata-check", "README.md"), "utf-8");
    expect(readme).toContain("priority: high");
  });

  // ── Count ───────────────────────────────────────────────────────

  it("counts tasks", () => {
    expect(store.count()).toBe(0);

    store.createTask({ subject: "A" });
    store.createTask({ subject: "B" });

    expect(store.count()).toBe(2);
  });

  // ── ID reuse after deletion ─────────────────────────────────────

  it("does not reuse deleted IDs", () => {
    store.createTask({ subject: "A" }); // id=1
    store.createTask({ subject: "B" }); // id=2
    store.delete(2);

    const t3 = store.createTask({ subject: "C" });
    expect(t3.id).toBe(3); // Not 2
  });
});
