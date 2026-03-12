/**
 * Task types for Telos v2
 * Mirrors schemas/task.yaml
 */

export type TaskStatus = 
  | 'pending' 
  | 'planning' 
  | 'in_progress' 
  | 'reviewing' 
  | 'blocked' 
  | 'completed' 
  | 'archived';

export interface TaskContextCapture {
  head_commit: string | null;
  open_files: string[];
  timestamp: string;
}

export interface Task {
  id: number;
  project_id: string;
  subject: string;
  status: TaskStatus;
  owner: string | null;
  created: string;                // ISO8601 timestamp
  updated: string;                // ISO8601 timestamp
  metadata: Record<string, any>;  // Free-form key-value pairs
  blockedBy: number[];
  blocks: number[];
  context_capture?: TaskContextCapture;
  parent_id: number | null;       // For subtask hierarchy (Phase 2)
  depth: number;                  // 0 = root, max 5
}

export interface TaskCreateInput {
  project_id: string;
  subject: string;
  description?: string;           // Goes into README.md
  owner?: string;
  status?: TaskStatus;
  metadata?: Record<string, any>;
  blockedBy?: number[];
  capture_context?: boolean;      // Auto-capture git/files (default: true)
}

export interface TaskCreateOutput {
  success: boolean;
  task: Task;
  path: string;                   // ~/.blackcat/telos/tasks/{id}/
}

export interface TaskGetInput {
  id: number;
  expand_subtasks?: boolean;      // Include nested subtasks (Phase 2)
}

export interface TaskGetOutput {
  task: Task;
  description: string;            // Content of README.md
  subtasks?: Task[];              // If expand_subtasks=true
}

export interface TaskListInput {
  project_id?: string;
  status?: TaskStatus | TaskStatus[];
  owner?: string;
  tags?: string[];                // Search in metadata
  sort?: 'created' | 'updated' | 'priority';
  limit?: number;
  offset?: number;
}

export interface TaskListOutput {
  tasks: Task[];
  total: number;
}

export interface TaskMoveInput {
  id: number;
  new_parent_id: number | null;   // null = make root task
}

export interface TaskMoveOutput {
  success: boolean;
  task: Task;
  old_path: string;
  new_path: string;
}

export interface TaskBulkCreateInput {
  project_id: string;
  tasks: Array<{
    subject: string;
    description?: string;
    metadata?: Record<string, any>;
  }>;
}

export interface TaskBulkCreateOutput {
  success: boolean;
  created: Task[];
  failed: Array<{ subject: string; error: string }>;
}
