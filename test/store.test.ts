import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TaskStore } from "../src/store.js";
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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
    const task = store.create({ subject: "Fix the bug" });

    expect(task.id).toBe(1);
    expect(task.subject).toBe("Fix the bug");
    expect(task.status).toBe("pending");
    expect(task.description).toBe("");
    expect(task.owner).toBe("");
    expect(task.blockedBy).toEqual([]);
    expect(task.blocks).toEqual([]);
    expect(task.tags).toEqual([]);
    expect(task.created).toBeTruthy();
    expect(task.updated).toBeTruthy();
  });

  it("creates a task with all fields", () => {
    const task = store.create({
      subject: "Add auth",
      description: "Implement JWT authentication",
      activeForm: "Adding authentication",
      owner: "echo",
      tags: ["backend", "security"],
    });

    expect(task.subject).toBe("Add auth");
    expect(task.description).toBe("Implement JWT authentication");
    expect(task.activeForm).toBe("Adding authentication");
    expect(task.owner).toBe("echo");
    expect(task.tags).toEqual(["backend", "security"]);
  });

  it("auto-increments IDs", () => {
    const t1 = store.create({ subject: "First" });
    const t2 = store.create({ subject: "Second" });
    const t3 = store.create({ subject: "Third" });

    expect(t1.id).toBe(1);
    expect(t2.id).toBe(2);
    expect(t3.id).toBe(3);
  });

  it("writes a readable markdown file with slug filename", () => {
    store.create({ subject: "Test task", description: "Some details here" });

    const raw = readFileSync(join(tmpDir, "1-test-task.md"), "utf-8");
    expect(raw).toContain("subject: Test task");
    expect(raw).toContain("status: pending");
    expect(raw).toContain("Some details here");
  });

  // ── Get ─────────────────────────────────────────────────────────

  it("gets a task by ID", () => {
    store.create({ subject: "Find me" });

    const task = store.get(1);
    expect(task).not.toBeNull();
    expect(task!.subject).toBe("Find me");
  });

  it("returns null for missing ID", () => {
    expect(store.get(999)).toBeNull();
  });

  // ── List ────────────────────────────────────────────────────────

  it("lists all tasks", () => {
    store.create({ subject: "A" });
    store.create({ subject: "B" });
    store.create({ subject: "C" });

    const tasks = store.list();
    expect(tasks).toHaveLength(3);
    expect(tasks[0].id).toBe(1);
    expect(tasks[2].id).toBe(3);
  });

  it("filters by status", () => {
    store.create({ subject: "Pending" });
    const t2 = store.create({ subject: "Done" });
    store.update(t2.id, { status: "completed" });

    const pending = store.list({ status: "pending" });
    expect(pending).toHaveLength(1);
    expect(pending[0].subject).toBe("Pending");

    const completed = store.list({ status: "completed" });
    expect(completed).toHaveLength(1);
    expect(completed[0].subject).toBe("Done");
  });

  it("filters by owner", () => {
    store.create({ subject: "A", owner: "echo" });
    store.create({ subject: "B", owner: "nyx" });

    const echoTasks = store.list({ owner: "echo" });
    expect(echoTasks).toHaveLength(1);
    expect(echoTasks[0].subject).toBe("A");
  });

  it("filters by tag", () => {
    store.create({ subject: "Backend work", tags: ["backend"] });
    store.create({ subject: "Frontend work", tags: ["frontend"] });

    const backend = store.list({ tag: "backend" });
    expect(backend).toHaveLength(1);
    expect(backend[0].subject).toBe("Backend work");
  });

  // ── Update ──────────────────────────────────────────────────────

  it("updates status", () => {
    const task = store.create({ subject: "Do it" });

    const updated = store.update(task.id, { status: "in_progress" });
    expect(updated!.status).toBe("in_progress");

    // Verify persisted
    const fromDisk = store.get(task.id);
    expect(fromDisk!.status).toBe("in_progress");
  });

  it("updates subject and description", () => {
    const task = store.create({ subject: "Old title", description: "Old desc" });

    const updated = store.update(task.id, {
      subject: "New title",
      description: "New desc",
    });

    expect(updated!.subject).toBe("New title");
    expect(updated!.description).toBe("New desc");
  });

  it("renames file when subject changes", () => {
    const task = store.create({ subject: "Original name" });
    expect(existsSync(join(tmpDir, "1-original-name.md"))).toBe(true);

    store.update(task.id, { subject: "Better name" });
    expect(existsSync(join(tmpDir, "1-original-name.md"))).toBe(false);
    expect(existsSync(join(tmpDir, "1-better-name.md"))).toBe(true);

    // Still accessible by ID
    const fetched = store.get(task.id);
    expect(fetched!.subject).toBe("Better name");
  });

  it("updates tags", () => {
    const task = store.create({ subject: "Tagged", tags: ["old"] });

    const updated = store.update(task.id, { tags: ["new", "shiny"] });
    expect(updated!.tags).toEqual(["new", "shiny"]);
  });

  it("returns null for missing ID", () => {
    expect(store.update(999, { status: "completed" })).toBeNull();
  });

  it("handles deleted status", () => {
    const task = store.create({ subject: "Bye" });

    const result = store.update(task.id, { status: "deleted" });
    expect(result).toBeNull(); // deleted returns null
    expect(store.get(task.id)).toBeNull(); // file removed
  });

  // ── Delete ──────────────────────────────────────────────────────

  it("deletes a task", () => {
    const task = store.create({ subject: "Delete me" });

    expect(store.delete(task.id)).toBe(true);
    expect(store.get(task.id)).toBeNull();
    expect(store.count()).toBe(0);
  });

  it("returns false for missing ID", () => {
    expect(store.delete(999)).toBe(false);
  });

  // ── Dependencies ────────────────────────────────────────────────

  it("sets up blockedBy on create", () => {
    const t1 = store.create({ subject: "First" });
    const t2 = store.create({ subject: "Second", blockedBy: [t1.id] });

    expect(t2.blockedBy).toEqual([1]);

    // Reverse: t1 should now list t2 in blocks
    const t1Updated = store.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);
  });

  it("adds blockedBy via update", () => {
    const t1 = store.create({ subject: "First" });
    const t2 = store.create({ subject: "Second" });

    store.update(t2.id, { addBlockedBy: [t1.id] });

    const updated = store.get(t2.id);
    expect(updated!.blockedBy).toEqual([1]);

    const t1Updated = store.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);
  });

  it("adds blocks via update", () => {
    const t1 = store.create({ subject: "First" });
    const t2 = store.create({ subject: "Second" });

    store.update(t1.id, { addBlocks: [t2.id] });

    const t1Updated = store.get(t1.id);
    expect(t1Updated!.blocks).toEqual([2]);

    const t2Updated = store.get(t2.id);
    expect(t2Updated!.blockedBy).toEqual([1]);
  });

  it("completing a task unblocks dependents", () => {
    const t1 = store.create({ subject: "Blocker" });
    store.create({ subject: "Blocked", blockedBy: [t1.id] });

    store.update(t1.id, { status: "completed" });

    const t2 = store.get(2);
    expect(t2!.blockedBy).toEqual([]);
  });

  it("deleting a task cleans up dependencies", () => {
    const t1 = store.create({ subject: "Will be deleted" });
    const t2 = store.create({ subject: "Depends on t1", blockedBy: [t1.id] });

    store.delete(t1.id);

    const t2Updated = store.get(t2.id);
    expect(t2Updated!.blockedBy).toEqual([]);
  });

  it("does not duplicate dependencies", () => {
    const t1 = store.create({ subject: "First" });
    const t2 = store.create({ subject: "Second", blockedBy: [t1.id] });

    // Try adding the same dependency again
    store.update(t2.id, { addBlockedBy: [t1.id] });

    const updated = store.get(t2.id);
    expect(updated!.blockedBy).toEqual([1]); // Not [1, 1]
  });

  // ── Metadata ─────────────────────────────────────────────────────

  it("creates a task with metadata", () => {
    const task = store.create({
      subject: "With metadata",
      metadata: { sources: "https://example.com", pr: "#42" },
    });

    expect(task.metadata).toEqual({ sources: "https://example.com", pr: "#42" });

    // Verify persisted
    const fromDisk = store.get(task.id);
    expect(fromDisk!.metadata).toEqual({ sources: "https://example.com", pr: "#42" });
  });

  it("defaults metadata to empty object", () => {
    const task = store.create({ subject: "No metadata" });
    expect(task.metadata).toEqual({});
  });

  it("merges metadata on update", () => {
    const task = store.create({
      subject: "Merge test",
      metadata: { a: "1", b: "2" },
    });

    store.update(task.id, { metadata: { b: "updated", c: "3" } });

    const updated = store.get(task.id);
    expect(updated!.metadata).toEqual({ a: "1", b: "updated", c: "3" });
  });

  it("deletes metadata keys via null", () => {
    const task = store.create({
      subject: "Delete key test",
      metadata: { keep: "yes", remove: "bye" },
    });

    store.update(task.id, { metadata: { remove: null } });

    const updated = store.get(task.id);
    expect(updated!.metadata).toEqual({ keep: "yes" });
  });

  it("stores metadata in frontmatter with metadata_ prefix", () => {
    store.create({
      subject: "Frontmatter check",
      metadata: { sources: "https://docs.example.com" },
    });

    const raw = readFileSync(join(tmpDir, "1-frontmatter-check.md"), "utf-8");
    expect(raw).toContain("metadata_sources: https://docs.example.com");
  });

  // ── Count ───────────────────────────────────────────────────────

  it("counts tasks", () => {
    expect(store.count()).toBe(0);

    store.create({ subject: "A" });
    store.create({ subject: "B" });

    expect(store.count()).toBe(2);
  });

  // ── ID reuse after deletion ─────────────────────────────────────

  it("does not reuse deleted IDs", () => {
    store.create({ subject: "A" }); // id=1
    store.create({ subject: "B" }); // id=2
    store.delete(2);

    const t3 = store.create({ subject: "C" });
    expect(t3.id).toBe(3); // Not 2
  });
});
