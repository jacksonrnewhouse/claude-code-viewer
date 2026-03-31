import { SystemError } from "@effect/platform/Error";
import { Effect, Option } from "effect";
import {
  createFileInfo,
  testFileSystemLayer,
} from "../../../../testing/layers/testFileSystemLayer";
import { testPlatformLayer } from "../../../../testing/layers/testPlatformLayer";
import { ArtifactRepository } from "./ArtifactRepository";

const artifactsDirPath = `${process.cwd()}/mock-global-claude-dir/artifacts`;

describe("ArtifactRepository", () => {
  describe("getArtifactsForSession", () => {
    it("returns artifacts with correct versions", async () => {
      const manifestContent = [
        JSON.stringify({
          id: "art-1",
          action: "create",
          title: "Dashboard",
          type: "dashboard",
          entry_point: "index.html",
          created_at: "2024-06-01T00:00:00.000Z",
          tags: ["test"],
          summary: "A dashboard",
          message_id: "msg-1",
        }),
        JSON.stringify({
          id: "art-1",
          action: "update",
          version: 2,
          created_at: "2024-06-01T01:00:00.000Z",
          changelog: "Updated layout",
          message_id: "msg-2",
        }),
        JSON.stringify({
          id: "art-2",
          action: "create",
          title: "Report",
          type: "explanation",
          entry_point: "index.html",
          created_at: "2024-06-01T02:00:00.000Z",
        }),
      ].join("\n");

      const manifestPath = `${artifactsDirPath}/my-project/session-1/manifest.jsonl`;

      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactsForSession("my-project", "session-1");
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(
            testFileSystemLayer({
              exists: (path: string) => Effect.succeed(path === manifestPath),
              readFileString: (path: string) =>
                path === manifestPath
                  ? Effect.succeed(manifestContent)
                  : Effect.fail(
                      new SystemError({
                        method: "readFileString",
                        reason: "NotFound",
                        module: "FileSystem",
                        cause: undefined,
                      }),
                    ),
            }),
          ),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toHaveLength(2);

      const art1 = result.find((a) => a.id === "art-1");
      expect(art1).toBeDefined();
      expect(art1?.title).toBe("Dashboard");
      expect(art1?.latestVersion).toBe(2);
      expect(art1?.versions).toHaveLength(2);
      expect(art1?.tags).toEqual(["test"]);
      expect(art1?.summary).toBe("A dashboard");
      expect(art1?.messageId).toBe("msg-1");
      expect(art1?.projectId).toBe("my-project");
      expect(art1?.sessionId).toBe("session-1");

      const v2 = art1?.versions.find((v) => v.version === 2);
      expect(v2?.changelog).toBe("Updated layout");
      expect(v2?.messageId).toBe("msg-2");

      const art2 = result.find((a) => a.id === "art-2");
      expect(art2).toBeDefined();
      expect(art2?.title).toBe("Report");
      expect(art2?.latestVersion).toBe(1);
      expect(art2?.versions).toHaveLength(1);
      expect(art2?.tags).toEqual([]);
      expect(art2?.summary).toBeNull();
    });

    it("returns empty array when no manifest exists", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactsForSession("no-project", "no-session");
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(
            testFileSystemLayer({
              exists: () => Effect.succeed(false),
            }),
          ),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toEqual([]);
    });
  });

  describe("getAllArtifacts", () => {
    it("aggregates across projects and sessions", async () => {
      const manifest1 = JSON.stringify({
        id: "art-1",
        action: "create",
        title: "First",
        type: "dashboard",
        entry_point: "index.html",
        created_at: "2024-06-01T00:00:00.000Z",
      });

      const manifest2 = JSON.stringify({
        id: "art-2",
        action: "create",
        title: "Second",
        type: "explanation",
        entry_point: "index.html",
        created_at: "2024-06-02T00:00:00.000Z",
      });

      const fileContents: Record<string, string> = {
        [`${artifactsDirPath}/proj-a/sess-1/manifest.jsonl`]: manifest1,
        [`${artifactsDirPath}/proj-b/sess-2/manifest.jsonl`]: manifest2,
      };

      const directories: Record<string, string[]> = {
        [artifactsDirPath]: ["proj-a", "proj-b"],
        [`${artifactsDirPath}/proj-a`]: ["sess-1"],
        [`${artifactsDirPath}/proj-b`]: ["sess-2"],
      };

      const dirPaths = new Set([
        artifactsDirPath,
        `${artifactsDirPath}/proj-a`,
        `${artifactsDirPath}/proj-b`,
        `${artifactsDirPath}/proj-a/sess-1`,
        `${artifactsDirPath}/proj-b/sess-2`,
      ]);

      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getAllArtifacts();
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(
            testFileSystemLayer({
              exists: (path: string) =>
                Effect.succeed(
                  path === artifactsDirPath ||
                    Object.keys(fileContents).includes(path),
                ),
              readFileString: (path: string) =>
                fileContents[path] !== undefined
                  ? Effect.succeed(fileContents[path])
                  : Effect.fail(
                      new SystemError({
                        method: "readFileString",
                        reason: "NotFound",
                        module: "FileSystem",
                        cause: undefined,
                      }),
                    ),
              readDirectory: (path: string) =>
                directories[path] !== undefined
                  ? Effect.succeed(directories[path])
                  : Effect.succeed([]),
              stat: (path: string) =>
                Effect.succeed(
                  createFileInfo({
                    type: dirPaths.has(path) ? "Directory" : "File",
                    mtime: Option.some(new Date()),
                  }),
                ),
            }),
          ),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(result).toHaveLength(2);
      // Sorted newest first
      expect(result[0]?.title).toBe("Second");
      expect(result[1]?.title).toBe("First");
    });
  });

  describe("getArtifactFile", () => {
    it("returns file content", async () => {
      const filePath = `${artifactsDirPath}/my-project/session-1/art-1/v1/index.html`;
      const fileContent = new TextEncoder().encode("<html>Hello</html>");

      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactFile(
          "my-project",
          "session-1",
          "art-1",
          1,
          "index.html",
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(
            testFileSystemLayer({
              readFile: (path: string) =>
                path === filePath
                  ? Effect.succeed(fileContent)
                  : Effect.fail(
                      new SystemError({
                        method: "readFile",
                        reason: "NotFound",
                        module: "FileSystem",
                        cause: undefined,
                      }),
                    ),
            }),
          ),
          Effect.provide(testPlatformLayer()),
        ),
      );

      expect(new TextDecoder().decode(result)).toBe("<html>Hello</html>");
    });

    it("fails for non-existent file", async () => {
      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactFile(
          "my-project",
          "session-1",
          "art-1",
          99,
          "missing.html",
        );
      });

      await expect(
        Effect.runPromise(
          program.pipe(
            Effect.provide(ArtifactRepository.Live),
            Effect.provide(
              testFileSystemLayer({
                readFile: () =>
                  Effect.fail(
                    new SystemError({
                      method: "readFile",
                      reason: "NotFound",
                      module: "FileSystem",
                      cause: undefined,
                    }),
                  ),
              }),
            ),
            Effect.provide(testPlatformLayer()),
          ),
        ),
      ).rejects.toThrow();
    });
  });
});
