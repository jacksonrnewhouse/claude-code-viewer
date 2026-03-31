import { SystemError } from "@effect/platform/Error";
import { Effect, Option } from "effect";
import {
  createFileInfo,
  testFileSystemLayer,
} from "../../../testing/layers/testFileSystemLayer";
import { testPlatformLayer } from "../../../testing/layers/testPlatformLayer";
import { ArtifactRepository } from "./infrastructure/ArtifactRepository";

const artifactsDirPath = "/test-artifacts";

/**
 * Helper that creates a mock filesystem layer from a flat map of file paths to
 * content strings, plus an explicit list of directory paths.
 *
 * `readDirectory` returns the direct children of the requested path by
 * scanning both the file map and the directory list.
 */
const createMockFs = (files: Record<string, string>, dirs: string[]) => {
  const dirSet = new Set(dirs);

  return testFileSystemLayer({
    exists: (path: string) => Effect.succeed(path in files || dirSet.has(path)),

    readFileString: (path: string) => {
      const content = files[path];
      return content !== undefined
        ? Effect.succeed(content)
        : Effect.fail(
            new SystemError({
              method: "readFileString",
              reason: "NotFound",
              module: "FileSystem",
              cause: undefined,
            }),
          );
    },

    readFile: (path: string) => {
      const content = files[path];
      return content !== undefined
        ? Effect.succeed(new TextEncoder().encode(content))
        : Effect.fail(
            new SystemError({
              method: "readFile",
              reason: "NotFound",
              module: "FileSystem",
              cause: undefined,
            }),
          );
    },

    readDirectory: (path: string) => {
      const entries = new Set<string>();
      const prefix = `${path}/`;
      for (const key of [...Object.keys(files), ...dirs]) {
        if (key.startsWith(prefix)) {
          const relative = key.slice(prefix.length);
          const firstSegment = relative.split("/")[0];
          if (firstSegment) entries.add(firstSegment);
        }
      }
      return Effect.succeed([...entries]);
    },

    stat: (path: string) =>
      Effect.succeed(
        createFileInfo({
          type: dirSet.has(path) ? "Directory" : "File",
          mtime: Option.some(new Date("2026-03-31T14:00:00Z")),
        }),
      ),
  });
};

describe("Artifact Integration — full lifecycle", () => {
  describe("Test 1: create + update produces correct versioned artifact", () => {
    it("returns 1 artifact with 2 versions, correct metadata", async () => {
      const manifestContent = [
        JSON.stringify({
          id: "art-lifecycle-1",
          action: "create",
          title: "Lifecycle Dashboard",
          type: "dashboard",
          entry_point: "index.html",
          created_at: "2026-03-31T10:00:00.000Z",
          tags: ["lifecycle", "test"],
          summary: "A test dashboard",
          message_id: "msg-create-1",
        }),
        JSON.stringify({
          id: "art-lifecycle-1",
          action: "update",
          version: 2,
          created_at: "2026-03-31T11:00:00.000Z",
          changelog: "Improved layout",
          message_id: "msg-update-1",
        }),
      ].join("\n");

      const files: Record<string, string> = {
        [`${artifactsDirPath}/-test-project/session-123/manifest.jsonl`]:
          manifestContent,
        [`${artifactsDirPath}/-test-project/session-123/art-lifecycle-1/v1/index.html`]:
          "<html>v1</html>",
        [`${artifactsDirPath}/-test-project/session-123/art-lifecycle-1/v2/index.html`]:
          "<html>v2</html>",
      };

      const dirs = [
        artifactsDirPath,
        `${artifactsDirPath}/-test-project`,
        `${artifactsDirPath}/-test-project/session-123`,
        `${artifactsDirPath}/-test-project/session-123/art-lifecycle-1`,
        `${artifactsDirPath}/-test-project/session-123/art-lifecycle-1/v1`,
        `${artifactsDirPath}/-test-project/session-123/art-lifecycle-1/v2`,
      ];

      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactsForSession(
          "-test-project",
          "session-123",
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(createMockFs(files, dirs)),
          Effect.provide(
            testPlatformLayer({
              claudeCodePaths: { artifactsDirPath },
            }),
          ),
        ),
      );

      expect(result).toHaveLength(1);

      const artifact = result[0];
      expect(artifact).toBeDefined();
      expect(artifact?.id).toBe("art-lifecycle-1");
      expect(artifact?.title).toBe("Lifecycle Dashboard");
      expect(artifact?.type).toBe("dashboard");
      expect(artifact?.entryPoint).toBe("index.html");
      expect(artifact?.tags).toEqual(["lifecycle", "test"]);
      expect(artifact?.summary).toBe("A test dashboard");
      expect(artifact?.messageId).toBe("msg-create-1");
      expect(artifact?.projectId).toBe("-test-project");
      expect(artifact?.sessionId).toBe("session-123");

      // Versioning
      expect(artifact?.latestVersion).toBe(2);
      expect(artifact?.versions).toHaveLength(2);

      const v1 = artifact?.versions.find((v) => v.version === 1);
      expect(v1).toBeDefined();
      expect(v1?.changelog).toBeNull();
      expect(v1?.messageId).toBe("msg-create-1");

      const v2 = artifact?.versions.find((v) => v.version === 2);
      expect(v2).toBeDefined();
      expect(v2?.changelog).toBe("Improved layout");
      expect(v2?.messageId).toBe("msg-update-1");
    });
  });

  describe("Test 2: multiple artifacts across multiple projects and sessions", () => {
    it("getAllArtifacts returns all artifacts sorted newest first", async () => {
      const manifest1 = JSON.stringify({
        id: "art-alpha",
        action: "create",
        title: "Alpha",
        type: "explanation",
        entry_point: "index.html",
        created_at: "2026-03-30T08:00:00.000Z",
      });

      const manifest2 = JSON.stringify({
        id: "art-beta",
        action: "create",
        title: "Beta",
        type: "comparison",
        entry_point: "index.html",
        created_at: "2026-03-31T12:00:00.000Z",
        tags: ["beta"],
        summary: "Beta artifact",
      });

      const files: Record<string, string> = {
        [`${artifactsDirPath}/project-one/sess-a/manifest.jsonl`]: manifest1,
        [`${artifactsDirPath}/project-two/sess-b/manifest.jsonl`]: manifest2,
      };

      const dirs = [
        artifactsDirPath,
        `${artifactsDirPath}/project-one`,
        `${artifactsDirPath}/project-one/sess-a`,
        `${artifactsDirPath}/project-two`,
        `${artifactsDirPath}/project-two/sess-b`,
      ];

      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getAllArtifacts();
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(createMockFs(files, dirs)),
          Effect.provide(
            testPlatformLayer({
              claudeCodePaths: { artifactsDirPath },
            }),
          ),
        ),
      );

      expect(result).toHaveLength(2);

      // Sorted newest first: Beta (2026-03-31) before Alpha (2026-03-30)
      expect(result[0]?.title).toBe("Beta");
      expect(result[0]?.id).toBe("art-beta");
      expect(result[0]?.projectId).toBe("project-two");
      expect(result[0]?.sessionId).toBe("sess-b");
      expect(result[0]?.tags).toEqual(["beta"]);
      expect(result[0]?.summary).toBe("Beta artifact");

      expect(result[1]?.title).toBe("Alpha");
      expect(result[1]?.id).toBe("art-alpha");
      expect(result[1]?.projectId).toBe("project-one");
      expect(result[1]?.sessionId).toBe("sess-a");
    });
  });

  describe("Test 3: getArtifactFile returns file content as Uint8Array", () => {
    it("returns the correct bytes for a versioned artifact file", async () => {
      const htmlContent = "<!DOCTYPE html><html><body>v1 content</body></html>";
      const filePath = `${artifactsDirPath}/my-proj/my-sess/art-file-1/v1/index.html`;

      const files: Record<string, string> = {
        [filePath]: htmlContent,
        [`${artifactsDirPath}/my-proj/my-sess/manifest.jsonl`]: JSON.stringify({
          id: "art-file-1",
          action: "create",
          title: "File Test",
          type: "review",
          entry_point: "index.html",
          created_at: "2026-03-31T10:00:00.000Z",
        }),
      };

      const dirs = [
        artifactsDirPath,
        `${artifactsDirPath}/my-proj`,
        `${artifactsDirPath}/my-proj/my-sess`,
        `${artifactsDirPath}/my-proj/my-sess/art-file-1`,
        `${artifactsDirPath}/my-proj/my-sess/art-file-1/v1`,
      ];

      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactFile(
          "my-proj",
          "my-sess",
          "art-file-1",
          1,
          "index.html",
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(createMockFs(files, dirs)),
          Effect.provide(
            testPlatformLayer({
              claudeCodePaths: { artifactsDirPath },
            }),
          ),
        ),
      );

      expect(result).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(result)).toBe(htmlContent);
    });
  });

  describe("Test 4: missing manifest returns empty array", () => {
    it("getArtifactsForSession returns [] when no manifest.jsonl exists", async () => {
      // Project directory exists but contains no manifest.jsonl
      const dirs = [
        artifactsDirPath,
        `${artifactsDirPath}/empty-project`,
        `${artifactsDirPath}/empty-project/orphan-session`,
      ];

      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactsForSession(
          "empty-project",
          "orphan-session",
        );
      });

      const result = await Effect.runPromise(
        program.pipe(
          Effect.provide(ArtifactRepository.Live),
          Effect.provide(createMockFs({}, dirs)),
          Effect.provide(
            testPlatformLayer({
              claudeCodePaths: { artifactsDirPath },
            }),
          ),
        ),
      );

      expect(result).toEqual([]);
    });
  });

  describe("Test 5: getArtifactFile fails for non-existent file", () => {
    it("rejects when the requested file does not exist", async () => {
      // No files in filesystem at all — readFile will return NotFound
      const program = Effect.gen(function* () {
        const repo = yield* ArtifactRepository;
        return yield* repo.getArtifactFile(
          "ghost-project",
          "ghost-session",
          "ghost-artifact",
          99,
          "missing.html",
        );
      });

      await expect(
        Effect.runPromise(
          program.pipe(
            Effect.provide(ArtifactRepository.Live),
            Effect.provide(createMockFs({}, [])),
            Effect.provide(
              testPlatformLayer({
                claudeCodePaths: { artifactsDirPath },
              }),
            ),
          ),
        ),
      ).rejects.toThrow();
    });
  });
});
