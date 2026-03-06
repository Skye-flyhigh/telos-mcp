import { describe, it, expect } from "vitest";
import { parseFrontmatter, serializeFrontmatter, slugify } from "../src/utils.js";

describe("parseFrontmatter", () => {
  it("parses basic frontmatter", () => {
    const raw = `---
id: 1
subject: Test task
status: pending
---

Some description here.`;

    const { data, body } = parseFrontmatter(raw);
    expect(data.id).toBe(1);
    expect(data.subject).toBe("Test task");
    expect(data.status).toBe("pending");
    expect(body).toBe("Some description here.");
  });

  it("parses arrays", () => {
    const raw = `---
blockedBy: [1, 2, 3]
tags: [backend, auth]
---`;

    const { data } = parseFrontmatter(raw);
    expect(data.blockedBy).toEqual([1, 2, 3]);
    expect(data.tags).toEqual(["backend", "auth"]);
  });

  it("parses empty arrays", () => {
    const raw = `---
blockedBy: []
tags: []
---`;

    const { data } = parseFrontmatter(raw);
    expect(data.blockedBy).toEqual([]);
    expect(data.tags).toEqual([]);
  });

  it("reconstructs metadata_ prefixed keys into metadata object", () => {
    const raw = `---
id: 1
metadata_sources: https://example.com
metadata_pr: #42
---`;

    const { data } = parseFrontmatter(raw);
    expect(data.metadata).toEqual({ sources: "https://example.com", pr: "#42" });
    expect(data).not.toHaveProperty("metadata_sources");
    expect(data).not.toHaveProperty("metadata_pr");
  });

  it("handles no frontmatter", () => {
    const raw = "Just some text.";
    const { data, body } = parseFrontmatter(raw);
    expect(data).toEqual({});
    expect(body).toBe("Just some text.");
  });

  it("handles empty body", () => {
    const raw = `---
id: 1
---`;

    const { data, body } = parseFrontmatter(raw);
    expect(data.id).toBe(1);
    expect(body).toBe("");
  });

  it("preserves multiline body", () => {
    const raw = `---
id: 1
---

Line one.

Line two.

- bullet`;

    const { body } = parseFrontmatter(raw);
    expect(body).toContain("Line one.");
    expect(body).toContain("Line two.");
    expect(body).toContain("- bullet");
  });
});

describe("slugify", () => {
  it("converts to lowercase kebab-case", () => {
    expect(slugify("Fix the Bug")).toBe("fix-the-bug");
  });

  it("strips special characters", () => {
    expect(slugify("Fix ABI mismatch (mnemo)")).toBe("fix-abi-mismatch-mnemo");
  });

  it("collapses multiple separators", () => {
    expect(slugify("too   many   spaces")).toBe("too-many-spaces");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("truncates to maxLength", () => {
    const long = "this is a very long subject that should be truncated at some point";
    const slug = slugify(long, 20);
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });
});

describe("serializeFrontmatter", () => {
  it("serializes basic data", () => {
    const result = serializeFrontmatter(
      { id: 1, subject: "Test", status: "pending" },
      "Description",
    );

    expect(result).toContain("---");
    expect(result).toContain("id: 1");
    expect(result).toContain("subject: Test");
    expect(result).toContain("Description");
  });

  it("serializes arrays", () => {
    const result = serializeFrontmatter(
      { blockedBy: [1, 2], tags: ["a", "b"] },
      "",
    );

    expect(result).toContain("blockedBy: [1, 2]");
    expect(result).toContain("tags: [a, b]");
  });

  it("serializes empty arrays", () => {
    const result = serializeFrontmatter({ blockedBy: [] }, "");
    expect(result).toContain("blockedBy: []");
  });

  it("serializes metadata as prefixed keys", () => {
    const result = serializeFrontmatter(
      { id: 1, metadata: { sources: "https://example.com", pr: "#42" } },
      "",
    );

    expect(result).toContain("metadata_sources: https://example.com");
    expect(result).toContain("metadata_pr: #42");
    expect(result).not.toContain("metadata:");
  });

  it("skips null/undefined values", () => {
    const result = serializeFrontmatter(
      { id: 1, nothing: null, missing: undefined },
      "",
    );

    expect(result).toContain("id: 1");
    expect(result).not.toContain("nothing");
    expect(result).not.toContain("missing");
  });

  it("roundtrips correctly", () => {
    const original = {
      id: 42,
      subject: "Roundtrip test",
      status: "in_progress",
      blockedBy: [1, 3],
      tags: ["test"],
    };

    const serialized = serializeFrontmatter(original, "Body text");
    const { data, body } = parseFrontmatter(serialized);

    expect(data.id).toBe(42);
    expect(data.subject).toBe("Roundtrip test");
    expect(data.status).toBe("in_progress");
    expect(data.blockedBy).toEqual([1, 3]);
    expect(data.tags).toEqual(["test"]);
    expect(body).toBe("Body text");
  });
});
