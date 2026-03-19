import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectStore } from "../src/project-store.ts";

let projectStore: ProjectStore
let tmpDir: string

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "telos-test-"))
    const archiveDir = join(tmpDir, "archive");
    const projectsDir = join(tmpDir, "projects");
    projectStore = new ProjectStore(projectsDir, archiveDir);
})

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true})
})

describe("ProjectStore", () => {

    // ── Create ──────────────────────────────────────────────────────

    it("creates a simple project", () => {
        const project = projectStore.create({
            key: 'simple-project',
            display_name: "Simple Project"
        })

        expect(project.key).toBe("simple-project")
        expect(project.display_name).toBe("Simple Project")
    }) 

    it("creates a project with all the optional fields", () => {
        const project = projectStore.create({
            key: 'super-project',
            display_name: "Super Mega Cool Project",
            description: "Things will be super amazing",
            base_path: "Users/Super/Path/To/Amazing",
            tech_stack: ["Super_stack", "Amazing_database"],
            repo_url: "https://skye-flyhigh.github.io/telos-mcp",
            sources: ["good-idea.md", "https://onceuponatime.com"]
        })

        expect(project.key).toBe('super-project')
        expect(project.display_name).toBe("Super Mega Cool Project")
        expect(project.base_path).toBe("Users/Super/Path/To/Amazing")
        expect(project.tech_stack).toEqual(["Super_stack", "Amazing_database"])
        expect(project.description).toBe("Things will be super amazing")
        expect(project.repo_url).toBe("https://skye-flyhigh.github.io/telos-mcp")
        expect(project.sources).toEqual(["good-idea.md", "https://onceuponatime.com"])
    })

    it("throws error for duplicate key", () => {
        const project1 = projectStore.create({ key: "duplicate", display_name: "Project 1" })

        expect(project1.key).toBe('duplicate')
        expect(() => {
            projectStore.create({ key: "duplicate", display_name: "Project 2"});
            }).toThrow('already exists');
    })

    it("writes project.md with YAML frontmatter in folder", () => {
        projectStore.create({
            key: "write-project",
            display_name: "Write Project",
            description: "Write Project Description",
        })

        const file = readFileSync(join(tmpDir, "projects", "write-project", "project.md"), { encoding: 'utf8' })
        expect(file).toContain("---")
        expect(file).toContain("created")
        expect(file).toContain("key: write-project")
        expect(file).toContain("display_name: Write Project")
        expect(file).toContain("status: active")
        expect(file).toContain("Write Project Description")
    })

    // ── Get ─────────────────────────────────────────────────────────

    it("gets a project by key", () => {
        // Create a project first
        const project = projectStore.create({
        key: "test-project",
        display_name: "Test Project"
        });

        // Get it back
        const found = projectStore.get("test-project");

        expect(project.key).toBe("test-project")
        expect(found).not.toBeNull();
        expect(found!.key).toBe("test-project");
        expect(found!.display_name).toBe("Test Project");
    });

    it("gets returns null for missing project", () => {
        expect(projectStore.get("nonexistent")).toBeNull();
    });

    // ── update ─────────────────────────────────────────────────────────
    
    it("updates project fields", () => {
        // Create first
        projectStore.create({ key: "update-test", display_name: "Old Name" });

        // Update
        const updated = projectStore.update("update-test", {
        display_name: "New Name",
        description: "Added description"
        });

        expect(updated!.display_name).toBe("New Name");
        expect(updated!.description).toBe("Added description");

        // Verify persisted
        const fromDisk = projectStore.get("update-test");
        expect(fromDisk!.display_name).toBe("New Name");
    });

    // ── archive ─────────────────────────────────────────────────────────

    it("archives a project", () => {
        const project = projectStore.create({ key: "archive-test", display_name: "Archive Test" });
        expect(project.status).toBe('active');

        // Archive
        projectStore.archive("archive-test");

        // Verify archived
        const fromDisk = projectStore.get("archive-test");
        expect(fromDisk!.status).toBe('archived');
    });

    it("archives an archived test", () => {
        const project = projectStore.create({
            key: "archive-test",
            display_name: "Archive Test",
        })
        expect(project.status).toBe("active")

        projectStore.archive("archive-test");

        expect(() => {
            projectStore.archive("archive-test");
        }).toThrow('already archived');
    })

    it("returns null for missing project", () => {
        const result = projectStore.archive("nonexistent");
        expect(result).toBeNull();
    });

    // ── list & count ─────────────────────────────────────────────────────────

    it("lists projects", () => {
        projectStore.create({ key: "list-test1", display_name: "List Test 1" });
        projectStore.create({ key: "list-test2", display_name: "List Test 2" });
        projectStore.create({ key: "list-test3", display_name: "List Test 3" });

        const count = projectStore.count()

        expect(count).toBe(3)
    })

    it("lists projects with status", () => {
        projectStore.create({ key: "list-test1", display_name: "List Test 1" });
        projectStore.create({ key: "list-test2", display_name: "List Test 2" });
        projectStore.create({ key: "list-test3", display_name: "List Test 3" });

        const list = projectStore.list()

        expect(list).toHaveLength(3)
        const keys = list.map(p => p.key);
        expect(keys).toContain("list-test1");
        expect(keys).toContain("list-test2");
        expect(keys).toContain("list-test3");
    })
});