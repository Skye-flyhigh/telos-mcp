import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Project, ProjectListFilters } from "./types.js";
import { isoNow, parseYaml, serializeYaml } from "./utils.js";

export class ProjectStore {
  private projectsRoot: string;
  private archiveRoot: string;

  constructor(projectsRoot: string, archiveRoot: string) {
    this.projectsRoot = projectsRoot;
    this.archiveRoot = archiveRoot;
    mkdirSync(projectsRoot, { recursive: true });
    mkdirSync(archiveRoot, { recursive: true });
  }

  create(fields: {
    key: string;
    display_name: string;
    description?: string;
    base_path?: string;
    tech_stack?: string[];
    repo_url?: string;
    sources?: string[];
  }): Project {
    // Validate key uniqueness
    if (this.exists(fields.key)) {
      throw new Error(`Project with key "${fields.key}" already exists`);
    }

    // Validate key format
    if (!/^[a-z0-9-]+$/.test(fields.key)) {
      throw new Error(`Project key must match ^[a-z0-9-]+$ (kebab-case, no spaces)`);
    }

    const now = isoNow();

    const project: Project = {
      key: fields.key,
      display_name: fields.display_name,
      description: fields.description ?? "",
      base_path: fields.base_path ?? "",
      tech_stack: fields.tech_stack ?? [],
      repo_url: fields.repo_url ?? "",
      status: "active",
      created: now,
      updated: now,
      archived_at: null,
      archived_reason: null,
      sources: fields.sources ?? [],
    };

    this.writeProject(project);
    return project;
  }

  get(key: string): Project | null {
    const path = this.projectPath(key);
    if (!existsSync(path)) return null;
    return this.readProject(path);
  }

  list(filters?: ProjectListFilters): Project[] {
    const keys = this.projectKeys();
    const results: Project[] = [];

    for (const key of keys) {
      const project = this.get(key);
      if (!project) continue;

      if (filters?.status && filters.status !== "all" && project.status !== filters.status) continue;
      if (filters?.tech_stack) {
        const hasTech = filters.tech_stack.some((tech) => project.tech_stack.includes(tech));
        if (!hasTech) continue;
      }
      if (filters?.search) {
        const search = filters.search.toLowerCase();
        const matchable = `${project.key} ${project.display_name} ${project.description}`.toLowerCase();
        if (!matchable.includes(search)) continue;
      }

      results.push(project);
    }

    // Sort
    const sortField = filters?.sort ?? "updated";
    results.sort((a, b) => {
      if (sortField === "name") return a.display_name.localeCompare(b.display_name);
      if (sortField === "task_count") {
        // Would need task store to count - skip for now
        return 0;
      }
      return b[sortField].localeCompare(a[sortField]); // Descending for dates
    });

    // Pagination
    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;
    return results.slice(offset, offset + limit);
  }

  archive(key: string, reason?: string): Project | null {
    const project = this.get(key);
    if (!project) return null;

    if (project.status === "archived") {
      throw new Error(`Project "${key}" is already archived`);
    }

    const now = isoNow();

    // Update project
    project.status = "archived";
    project.updated = now;
    project.archived_at = now;
    project.archived_reason = reason ?? null;

    // Move to archive
    const oldPath = this.projectPath(key);
    const year = now.slice(0, 4); // "2026"
    const archiveDir = join(this.archiveRoot, year);
    mkdirSync(archiveDir, { recursive: true });
    const newPath = join(archiveDir, `${key}.yaml`);

    renameSync(oldPath, newPath);
    this.writeProjectAt(project, newPath);

    return project;
  }

  exists(key: string): boolean {
    return existsSync(this.projectPath(key));
  }

  count(): number {
    return this.projectKeys().length;
  }

  /** Get the root directory for projects */
  getRoot(): string {
    return this.projectsRoot;
  }

  // ── Private ────────────────────────────────────────────────────

  private projectPath(key: string): string {
    return join(this.projectsRoot, key, "project.yaml");
  }

  private projectKeys(): string[] {
    if (!existsSync(this.projectsRoot)) return [];
    return readdirSync(this.projectsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((name) => /^[a-z0-9-]+$/.test(name));
  }

  private readProject(path: string): Project {
    const raw = readFileSync(path, "utf-8");
    const data = parseYaml(raw) as Record<string, unknown>;

    // Ensure all fields exist (migration safety)
    return {
      key: String(data.key),
      display_name: String(data.display_name),
      description: String(data.description ?? ""),
      base_path: String(data.base_path ?? ""),
      tech_stack: Array.isArray(data.tech_stack) ? data.tech_stack.map(String) : [],
      repo_url: String(data.repo_url ?? ""),
      status: data.status as Project["status"],
      created: String(data.created),
      updated: String(data.updated),
      archived_at: data.archived_at ? String(data.archived_at) : null,
      archived_reason: data.archived_reason ? String(data.archived_reason) : null,
      sources: Array.isArray(data.sources) ? data.sources.map(String) : [],
    };
  }

  private writeProject(project: Project): void {
    const path = this.projectPath(project.key);
    this.writeProjectAt(project, path);
  }

  private writeProjectAt(project: Project, path: string): void {
    const dir = path.slice(0, path.lastIndexOf("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, serializeYaml(project as unknown as Record<string, unknown>), "utf-8");
  }
}
