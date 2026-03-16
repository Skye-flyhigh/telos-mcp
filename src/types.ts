// Telos Types
// Project-based organization with folder-based tasks


export const VALID_PROJECT_STATUSES = ["active", "paused", "archived"] as const;
export type ProjectStatus = typeof VALID_PROJECT_STATUSES[number];

export type TaskStatus = typeof VALID_TASK_STATUSES[number]
export const VALID_TASK_STATUSES = ["pending", "planning", "in_progress", "reviewing", "blocked", "completed", "archived", "deleted"] as const;

export interface Project {
  key: string;                    // Unique identifier, kebab-case
  display_name: string;           // Human-readable name
  description: string;            // Optional description
  base_path: string;              // Absolute path to project source
  tech_stack: string[];           // Technologies used
  repo_url: string;               // Git repository URL
  status: ProjectStatus;          // Current status
  created: string;                // ISO8601 timestamp
  updated: string;                // ISO8601 timestamp
  archived_at: string | null;     // When archived (null if active)
  archived_reason: string | null; // Reason for archiving
  sources: string[];              // References, documentation, research sources
}

export interface Task {
  id: number;
  project_id: string | null;      // Reference to project.key (null for unassigned)
  subject: string;
  description: string;            // Now stored in README.md
  status: TaskStatus;
  owner: string | null;
  created: string;
  updated: string;
  blockedBy: number[];
  blocks: number[];
  tags: string[] | null;
  metadata: Record<string, unknown>;  // Free-form key-value
  parent_id: number | null;       // For subtask hierarchy (Phase 2)
  context_capture: ContextCapture | null;
  depth: number;                  // Nesting level (0 = root)
  sources: string[];              // URLs, references, documentation used for this task
}

export interface ContextCapture {
  head_commit: string | null;
  open_files: string[] | null;
  urls: string[] | null;
  snippets: string[] | null;
  timestamp: string;
}

export interface TaskSummary {
  id: number;
  project_id: string | null;
  subject: string;
  status: TaskStatus;
  owner: string | null;
  blockedBy: number[];
  tags: string[] | null;
  depth: number;
}

export interface ProjectListFilters {
  status?: ProjectStatus | "all";
  tech_stack?: string[];
  search?: string;
  sort?: "updated" | "created" | "name" | "task_count";
  limit?: number;
  offset?: number;
}

export interface TaskListFilters {
  project_id?: string;
  status?: TaskStatus | "all";
  owner?: string;
  parent_id?: number | null;  // null for root tasks only
  depth?: number;
  sort?: "updated" | "created" | "subject";
  limit?: number;
  offset?: number;
}

// Alias for backward compatibility
export type ListFilters = TaskListFilters;

export interface TelosConfig {
  dir: string;
  version: string;
  tasks_root: string;
  projects_root: string;
  archive_root: string;
  next_task_id: number;
  default_project: string | null;
}

// Utility type for MCP operation inputs
export interface ProjectCreateInput {
  key: string;
  display_name: string;
  description?: string;
  base_path?: string;
  tech_stack?: string[];
  repo_url?: string;
  clone?: boolean;  // If true, git clone repo_url to base_path
  sources?: string[];  // Initial sources/references for the project
}

export interface ProjectArchiveInput {
  key: string;
  reason?: string;
  archive_tasks?: boolean;
  force?: boolean;
}

export interface TaskCreateInput {
  subject: string;
  project_id?: string;
  description?: string;
  activeForm?: string;
  owner?: string;
  blockedBy?: number[];
  metadata?: Record<string, unknown>;
  parent_id?: number;  // Phase 2
  sources?: string[];  // URLs, references used for planning this task
}
