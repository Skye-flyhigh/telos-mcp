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
      lines.push(`${key}: [${val.join(", ")}]`);
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
