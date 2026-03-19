/**
 * Minimal frontmatter parser/serializer.
 * Handles strings, numbers, booleans, and flat arrays — no nested objects.
 */

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const data: Record<string, unknown> = {};

  if (!raw.startsWith("---")) {
    return { data, body: raw };
  }

  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { data, body: raw };
  }

  const frontmatter = raw.slice(4, end).trim();
  const body = raw.slice(end + 4).trim();

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    data[key] = parseValue(val);
  }

  // Reconstruct metadata_ prefixed keys into a metadata object
  const metadata: Record<string, string> = {};
  for (const key of Object.keys(data)) {
    if (key.startsWith("metadata_")) {
      metadata[key.slice(9)] = String(data[key]);
      delete data[key];
    }
  }
  if (Object.keys(metadata).length > 0) {
    data.metadata = metadata;
  }

  return { data, body };
}

function parseValue(val: string): unknown {
  // Array: [a, b, c] or [1, 2, 3]
  if (val.startsWith("[") && val.endsWith("]")) {
    const inner = val.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => {
      const trimmed = item.trim();
      const num = Number(trimmed);
      return Number.isNaN(num) ? trimmed : num;
    });
  }

  // Number
  const num = Number(val);
  if (val !== "" && !Number.isNaN(num)) return num;

  // Boolean
  if (val === "true") return true;
  if (val === "false") return false;

  // String (strip surrounding quotes if present)
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }

  return val;
}

/** Check if a string needs quotes in YAML (contains special characters) */
function needsQuotes(str: string): boolean {
  // Needs quotes if contains: # (comment), : (key separator), [ ] (array), { } (object),
  // , (list separator), ' (quote), " (quote), leading/trailing space, or is empty
  if (str.length === 0) return true;
  if (str.startsWith(" ") || str.endsWith(" ")) return true;
  if (/[#[\]{}:,'"\n\r]/.test(str)) return true;
  // Also quote if it looks like a number/boolean/null but isn't
  if (str === "true" || str === "false" || str === "null" || str === "~") return true;
  if (/^-?\d+(\.\d+)?$/.test(str)) return true;
  return false;
}

export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  const lines: string[] = ["---"];

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;

    // Expand metadata object into metadata_ prefixed keys
    if (key === "metadata" && typeof val === "object" && !Array.isArray(val)) {
      for (const [mk, mv] of Object.entries(val as Record<string, string>)) {
        if (mv === undefined || mv === null) continue;
        lines.push(`metadata_${mk}: ${mv}`);
      }
      continue;
    }

    if (Array.isArray(val)) {
      // Quote strings that need it (contain special YAML characters)
      const formatted = val.map((item) => {
        if (typeof item === "string" && needsQuotes(item)) {
          return `"${item.replace(/"/g, '\\"')}"`;
        }
        return String(item);
      });
      lines.push(`${key}: [${formatted.join(", ")}]`);
    } else if (typeof val === "string") {
      // Quote strings that need it
      if (needsQuotes(val)) {
        lines.push(`${key}: "${val.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${val}`);
      }
    } else {
      lines.push(`${key}: ${val}`);
    }
  }

  lines.push("---");

  if (body) {
    lines.push("", body);
  }

  return lines.join("\n") + "\n";
}

export function slugify(text: string, maxLength = 50): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLength)
    .replace(/-$/, "");
}

export function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Minimal YAML parser for simple objects.
 * Handles: strings, numbers, booleans, nulls, arrays, and flat objects.
 * Does NOT handle: nested objects, multi-line strings, complex YAML features.
 */
export function parseYaml(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    // Check for object start (key:)
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    // If rest is empty, check if next lines are indented (object value)
    if (rest === "") {
      // Look for indented values
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const childIndent = indent + 2;
      const childLines: string[] = [];
      i++;

      while (i < lines.length) {
        const nextLine = lines[i];
        const nextTrimmed = nextLine.trim();

        if (!nextTrimmed) {
          i++;
          continue;
        }

        const nextIndent = nextLine.match(/^(\s*)/)?.[1].length || 0;
        if (nextIndent >= childIndent) {
          childLines.push(nextLine.slice(childIndent));
          i++;
        } else {
          break;
        }
      }

      if (childLines.length > 0) {
        result[key] = parseYaml(childLines.join("\n"));
      } else {
        result[key] = null;
      }
      continue;
    }

    // Parse the value
    result[key] = parseYamlValue(rest);
    i++;
  }

  return result;
}

function parseYamlValue(val: string): unknown {
  val = val.trim();

  if (val === "" || val === "null" || val === "~") return null;
  if (val === "true") return true;
  if (val === "false") return false;

  // Array: [a, b, c]
  if (val.startsWith("[") && val.endsWith("]")) {
    const inner = val.slice(1, -1).trim();
    if (inner === "") return [];
    return inner.split(",").map((item) => {
      const trimmed = item.trim();
      const num = Number(trimmed);
      return Number.isNaN(num) ? trimmed : num;
    });
  }

  // Number
  const num = Number(val);
  if (!Number.isNaN(num)) return num;

  // String (strip quotes if present)
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }

  return val;
}

/**
 * Minimal YAML serializer for simple objects.
 * Handles: strings, numbers, booleans, nulls, arrays, and flat objects.
 */
export function serializeYaml(data: Record<string, unknown>, indent = 0): string {
  const lines: string[] = [];
  const prefix = " ".repeat(indent);

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;

    if (val === null) {
      lines.push(`${prefix}${key}: null`);
    } else if (typeof val === "boolean") {
      lines.push(`${prefix}${key}: ${val}`);
    } else if (typeof val === "number") {
      lines.push(`${prefix}${key}: ${val}`);
    } else if (typeof val === "string") {
      // Quote strings that need it
      if (val.includes(":") || val.includes("#") || val.includes("{") ||
          val.includes("[") || val.startsWith(" ") || val.startsWith("\"") ||
          val === "" || val === "true" || val === "false" || val === "null") {
        lines.push(`${prefix}${key}: "${val.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${prefix}${key}: ${val}`);
      }
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${prefix}${key}: []`);
      } else {
        const arrStr = val.map((item) => {
          if (typeof item === "string") return `"${item}"`;
          return String(item);
        }).join(", ");
        lines.push(`${prefix}${key}: [${arrStr}]`);
      }
    } else if (typeof val === "object") {
      lines.push(`${prefix}${key}:`);
      lines.push(serializeYaml(val as Record<string, unknown>, indent + 2));
    }
  }

  return lines.join("\n") + "\n";
}
