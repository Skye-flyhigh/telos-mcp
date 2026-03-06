import { homedir } from "node:os";
import { join } from "node:path";

export type TaskStatus = "pending" | "in_progress" | "completed";

export const VALID_STATUSES: TaskStatus[] = ["pending", "in_progress", "completed"];

export interface Task {
  id: number;
  subject: string;
  description: string;
  status: TaskStatus;
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
}

export interface ListFilters {
  status?: TaskStatus;
  owner?: string;
  tag?: string;
}

export interface TelosConfig {
  dir: string;
}

export function loadConfig(): TelosConfig {
  return {
    dir: process.env.TELOS_DIR ?? join(homedir(), ".telos"),
  };
}
