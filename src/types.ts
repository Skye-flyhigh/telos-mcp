import { homedir } from "node:os";
import { join } from "node:path";

export type TaskStatus = "pending" | "in_progress" | "completed" | "archived";
export const VALID_STATUSES: TaskStatus[] = ["pending", "in_progress", "completed", "archived"];

export interface Project {
  key: string;                    // Unique identifier (kebab-case: "black-cat", "telos")
  name: string;                   // Display name
  description: string;            // Markdown description
  root: string;                   // Absolute path to project root
  tags: string[];                 // Inherited by default (can override per-task)
  created: string;                // ISO timestamp
  updated: string;                // ISO timestamp
  metadata: Record<string, string>;
}

export interface Task {
  // Core identity
  id: number;
  subject: string;                // Imperative title
  activeForm: string;             // Present continuous (for spinner)

  // Relationships
  projectKey: string;             // Links to projects/{key}/
  parentId?: number;              // For subtasks (optional)
  blockedBy: number[];            // Dependency IDs
  blocks: number[];               // IDs this task blocks

  // Content
  description: string;            // Markdown with structured sections
  status: TaskStatus;

  // Metadata
  owner: string;
  tags: string[];
  metadata: Record<string, string>;

  // Timestamps
  created: string;
  updated: string;
}

// Legacy interface for migration (deprecated, remove after migration)
export interface TaskLegacy {
  id: number;
  subject: string;
  description: string;
  status: Exclude<TaskStatus, "archived">;
  created: string;
  updated: string;
  owner: string;
  activeForm: string;
  blockedBy: number[];
  blocks: number[];
  tags: string[];
  metadata: Record<string, string>;
}

export interface TaskSummary {
  id: number;
  subject: string;
  status: TaskStatus;
  owner: string;
  blockedBy: number[];
  tags: string[];
  projectKey: string;
}

export interface ProjectSummary {
  key: string;
  name: string;
  taskCount: number;
  activeTaskCount: number;
  tags: string[];
}

export interface ListFilters {
  status?: TaskStatus;
  owner?: string;
  tag?: string;
  projectKey?: string;
}

export interface TelosConfig {
  dir: string;
  projectsDir: string;
  tasksDir: string;
}

export function loadConfig(): TelosConfig {
  const baseDir = process.env.TELOS_DIR ?? join(homedir(), ".telos");
  return {
    dir: baseDir,
    projectsDir: join(baseDir, "projects"),
    tasksDir: join(baseDir, "tasks"),
  };
}

// Path helpers for folder-based structure
export function projectPath(config: TelosConfig, key: string): string {
  return join(config.projectsDir, key);
}

export function projectFilePath(config: TelosConfig, key: string): string {
  return join(projectPath(config, key), "project.yaml");
}

export function taskPath(config: TelosConfig, id: number): string {
  return join(config.tasksDir, id.toString());
}

export function taskFilePath(config: TelosConfig, id: number): string {
  return join(taskPath(config, id), "task.yaml");
}

export function taskDescriptionPath(config: TelosConfig, id: number): string {
  return join(taskPath(config, id), "description.md");
}
