import { parseManifest } from "./parseManifest";

describe("parseManifest", () => {
  it("parses create entries", () => {
    const content = JSON.stringify({
      id: "art-1",
      action: "create",
      title: "Test Artifact",
      type: "dashboard",
      entry_point: "index.html",
      created_at: "2024-06-01T00:00:00.000Z",
      tags: ["test"],
      summary: "A test artifact",
    });

    const entries = parseManifest(content);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: "art-1",
        action: "create",
        title: "Test Artifact",
        type: "dashboard",
        entry_point: "index.html",
      }),
    );
  });

  it("parses mixed create and update entries", () => {
    const lines = [
      JSON.stringify({
        id: "art-1",
        action: "create",
        title: "Test Artifact",
        type: "explanation",
        entry_point: "index.html",
        created_at: "2024-06-01T00:00:00.000Z",
      }),
      JSON.stringify({
        id: "art-1",
        action: "update",
        version: 2,
        created_at: "2024-06-01T01:00:00.000Z",
        changelog: "Updated content",
      }),
    ].join("\n");

    const entries = parseManifest(lines);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe("create");
    expect(entries[1]?.action).toBe("update");
    if (entries[1]?.action === "update") {
      expect(entries[1].version).toBe(2);
      expect(entries[1].changelog).toBe("Updated content");
    }
  });

  it("skips malformed lines", () => {
    const lines = [
      "not valid json",
      JSON.stringify({
        id: "art-1",
        action: "create",
        title: "Test Artifact",
        type: "dashboard",
        entry_point: "index.html",
        created_at: "2024-06-01T00:00:00.000Z",
      }),
      JSON.stringify({ id: "art-2", action: "unknown" }),
      "{ broken json",
    ].join("\n");

    const entries = parseManifest(lines);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual(
      expect.objectContaining({
        id: "art-1",
        action: "create",
      }),
    );
  });

  it("returns empty array for empty input", () => {
    expect(parseManifest("")).toEqual([]);
    expect(parseManifest("\n\n")).toEqual([]);
    expect(parseManifest("  \n  ")).toEqual([]);
  });
});
