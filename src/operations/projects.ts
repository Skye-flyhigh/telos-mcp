import { join } from "node:path";
import type { ProjectStore } from "../project-store.js";
import type {
  Project,
  ProjectArchiveInput,
  ProjectCreateInput,
  ProjectListFilters,
} from "../types.js";

export async function projectCreate(
  store: ProjectStore,
  input: ProjectCreateInput,
): Promise<{ project: Project; path: string; warnings?: string[] }> {
  const warnings: string[] = [];

  // Handle git clone if requested
  if (input.clone && input.repo_url) {
    const { execSync } = await import("node:child_process");
    const { existsSync, mkdirSync } = await import("node:fs");
    const { homedir } = await import("node:os");
    const { join } = await import("node:path");

    // Infer base_path if not provided
    if (!input.base_path) {
      const projectName = input.repo_url.split("/").pop()?.replace(/\.git$/, "") || input.key;
      input.base_path = join(homedir(), "Projects", projectName);
    }

    // Clone if directory doesn't exist
    if (!existsSync(input.base_path)) {
      try {
        mkdirSync(input.base_path, { recursive: true });
        execSync(`git clone "${input.repo_url}" "${input.base_path}"`, {
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch (err) {
        warnings.push(`Git clone failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      warnings.push(`Directory ${input.base_path} already exists, skipping clone`);
    }
  }

  const project = store.create({
    key: input.key,
    display_name: input.display_name,
    description: input.description,
    base_path: input.base_path,
    tech_stack: input.tech_stack,
    repo_url: input.repo_url,
    sources: input.sources,
  });

  const path = join(store.getRoot(), project.key);

  return { project, path, warnings: warnings.length > 0 ? warnings : undefined };
}

export function projectList(
  store: ProjectStore,
  filters?: ProjectListFilters,
): { projects: Project[]; total: number; page: { limit: number; offset: number } } {
  const allProjects = store.list({ ...filters, limit: undefined, offset: undefined });
  const projects = store.list(filters);

  return {
    projects,
    total: allProjects.length,
    page: {
      limit: filters?.limit ?? 100,
      offset: filters?.offset ?? 0,
    },
  };
}

export function projectArchive(
  store: ProjectStore,
  input: ProjectArchiveInput,
): { project: Project | null; archived_tasks_count?: number; warnings?: string[] } {
  const warnings: string[] = [];

  // Safety checks
  const project = store.get(input.key);
  if (!project) {
    return { project: null };
  }

  // TODO: Check for blockers (would need task store integration)
  // For now, just archive

  const archived = store.archive(input.key, input.reason);

  return {
    project: archived,
    archived_tasks_count: 0, // Would count tasks with this project_id
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
