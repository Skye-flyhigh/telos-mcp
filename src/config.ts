import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TelosConfig } from './types.js';
import { parseYaml, serializeYaml } from './utils.js';

const dir = process.env.TELOS_DIR ?? join(homedir(), '.telos');

export function loadConfig(path = join(dir, 'config.yaml')): TelosConfig {
  // Ensure directory exists
  mkdirSync(dirname(path), { recursive: true });

  if (!existsSync(path)) {
    const defaults: TelosConfig = {
      dir: dir,
      version: '0.2.0',
      tasks_root: join(dir, 'tasks'),
      projects_root: join(dir, 'projects'),
      archive_root: join(dir, 'archive'),
      next_task_id: 1,
      default_project: null,
    };

    // Write default config using our minimal YAML serializer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeFileSync(path, serializeYaml(defaults as any));
    return defaults;
  }

  const raw = readFileSync(path, 'utf-8');
  const parsed = parseYaml(raw);

  // TELOS_DIR env var always takes precedence over saved config
  const effectiveDir = process.env.TELOS_DIR || String(parsed.dir || dir);

  return {
    dir: effectiveDir,
    version: String(parsed.version || '0.2.0'),
    tasks_root: String(parsed.tasks_root || join(effectiveDir, 'tasks')),
    projects_root: String(parsed.projects_root || join(effectiveDir, 'projects')),
    archive_root: String(parsed.archive_root || join(effectiveDir, 'archive')),
    next_task_id: Number(parsed.next_task_id) || 1,
    default_project: parsed.default_project ? String(parsed.default_project) : null,
  };
}

// Re-export for convenience
export type { TelosConfig };
