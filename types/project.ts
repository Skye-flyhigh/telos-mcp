/**
 * Project types for Telos v2
 * Mirrors schemas/project.yaml
 */

export type ProjectStatus = 'active' | 'paused' | 'archived';

export interface Project {
  key: string;                    // Unique identifier (kebab-case)
  display_name: string;           // Human-readable name
  description?: string;           // Optional description
  base_path: string;              // Absolute path to project source
  tech_stack?: string[];          // Technologies used
  repo_url?: string;              // Git repository URL
  status: ProjectStatus;
  created: string;                // ISO8601 timestamp
  updated: string;                // ISO8601 timestamp
  archived_at?: string | null;    // When archived (null if active)
  archived_reason?: string | null;
}

export interface ProjectCreateInput {
  key: string;
  display_name: string;
  description?: string;
  base_path?: string;             // Optional: auto-derived from repo or default
  tech_stack?: string[];
  repo_url?: string;
  clone?: boolean;                // Clone repo_url to base_path
}

export interface ProjectCreateOutput {
  success: boolean;
  project: Project;
  path: string;                   // ~/.blackcat/telos/projects/{key}/
  suggested_tasks?: Task[];       // From mnemo context analysis
  errors?: string[];
}

export interface ProjectListInput {
  status?: ProjectStatus | 'all';
  tech_stack?: string[];          // Match ANY of these (OR)
  search?: string;                // Fuzzy match key/name/description
  sort?: 'updated' | 'created' | 'name' | 'task_count';
  limit?: number;
  offset?: number;
}

export interface ProjectListOutput {
  projects: Project[];
  total: number;
  page: { limit: number; offset: number };
  computed: {
    active_count: number;
    paused_count: number;
    archived_count: number;
  };
}

export interface ProjectArchiveInput {
  key: string;
  reason?: string;
  archive_tasks?: boolean;        // Default: true
  force?: boolean;                // Skip warnings
}

export interface ProjectArchiveOutput {
  success: boolean;
  archived_tasks_count: number;
  archive_path: string;
  warnings?: string[];
}

// Import from task.ts for suggested_tasks reference
import type { Task } from './task';
