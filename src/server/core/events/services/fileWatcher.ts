import { type FSWatcher, watch } from "node:fs";
import { readdir } from "node:fs/promises";
import { Path } from "@effect/platform";
import { Context, Effect, Layer, Ref } from "effect";
import { ApplicationContext } from "../../platform/services/ApplicationContext";
import { encodeProjectIdFromSessionFilePath } from "../../project/functions/id";
import { parseSessionFilePath } from "../functions/parseSessionFilePath";
import { EventBus } from "./EventBus";

interface FileWatcherServiceInterface {
  readonly startWatching: () => Effect.Effect<void>;
  readonly stop: () => Effect.Effect<void>;
}

export class FileWatcherService extends Context.Tag("FileWatcherService")<
  FileWatcherService,
  FileWatcherServiceInterface
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const eventBus = yield* EventBus;
      const context = yield* ApplicationContext;

      const isWatchingRef = yield* Ref.make(false);
      const watcherRef = yield* Ref.make<FSWatcher | null>(null);
      const projectWatchersRef = yield* Ref.make<Map<string, FSWatcher>>(
        new Map(),
      );
      const debounceTimersRef = yield* Ref.make<
        Map<string, ReturnType<typeof setTimeout>>
      >(new Map());

      /**
       * Emits the appropriate event for a changed file, with debouncing.
       */
      const handleFileChange = (
        claudeProjectsDirPath: string,
        relativePath: string,
      ) => {
        const fileMatch = parseSessionFilePath(relativePath);
        if (fileMatch === null) return;

        const fullPath = path.join(claudeProjectsDirPath, relativePath);
        const encodedProjectId = encodeProjectIdFromSessionFilePath(fullPath);

        const debounceKey =
          fileMatch.type === "agent"
            ? `${encodedProjectId}/agent-${fileMatch.agentSessionId}`
            : `${encodedProjectId}/${fileMatch.sessionId}`;

        Effect.runPromise(
          Effect.gen(function* () {
            const timers = yield* Ref.get(debounceTimersRef);
            const existingTimer = timers.get(debounceKey);
            if (existingTimer) {
              clearTimeout(existingTimer);
            }

            const newTimer = setTimeout(() => {
              if (fileMatch.type === "agent") {
                Effect.runFork(
                  eventBus.emit("agentSessionChanged", {
                    projectId: encodedProjectId,
                    agentSessionId: fileMatch.agentSessionId,
                  }),
                );
              } else {
                Effect.runFork(
                  eventBus.emit("sessionChanged", {
                    projectId: encodedProjectId,
                    sessionId: fileMatch.sessionId,
                  }),
                );

                Effect.runFork(
                  eventBus.emit("sessionListChanged", {
                    projectId: encodedProjectId,
                  }),
                );
              }

              Effect.runPromise(
                Effect.gen(function* () {
                  const currentTimers = yield* Ref.get(debounceTimersRef);
                  currentTimers.delete(debounceKey);
                  yield* Ref.set(debounceTimersRef, currentTimers);
                }),
              );
            }, 100);

            timers.set(debounceKey, newTimer);
            yield* Ref.set(debounceTimersRef, timers);
          }),
        );
      };

      /**
       * Creates a non-recursive watcher on a single project directory.
       * Watches for session JSONL files (e.g. <sessionId>.jsonl).
       */
      const watchProjectDir = (
        claudeProjectsDirPath: string,
        projectDirName: string,
      ) => {
        const projectDirPath = path.join(claudeProjectsDirPath, projectDirName);

        try {
          const watcher = watch(
            projectDirPath,
            { persistent: false, recursive: false },
            (_eventType, filename) => {
              if (!filename) return;
              // Build a relative path as if from the root projects dir
              const relativePath = path.join(projectDirName, filename);
              handleFileChange(claudeProjectsDirPath, relativePath);
            },
          );

          watcher.on("error", () => {
            // Directory may have been deleted; clean up silently
            watcher.close();
            Effect.runPromise(
              Ref.update(projectWatchersRef, (watchers) => {
                const next = new Map(watchers);
                next.delete(projectDirName);
                return next;
              }),
            );
          });

          Effect.runPromise(
            Ref.update(projectWatchersRef, (watchers) =>
              new Map(watchers).set(projectDirName, watcher),
            ),
          );
        } catch {
          // Directory may not exist or be inaccessible; skip silently
        }
      };

      /**
       * Watches a session's subagents directory for agent JSONL files.
       * These live at <projectDir>/<sessionId>/subagents/agent-*.jsonl
       */
      const watchSubagentsDir = (
        claudeProjectsDirPath: string,
        projectDirName: string,
        sessionDirName: string,
      ) => {
        const subagentsPath = path.join(
          claudeProjectsDirPath,
          projectDirName,
          sessionDirName,
          "subagents",
        );
        const watchKey = `${projectDirName}/${sessionDirName}/subagents`;

        try {
          const watcher = watch(
            subagentsPath,
            { persistent: false, recursive: false },
            (_eventType, filename) => {
              if (!filename) return;
              const relativePath = path.join(
                projectDirName,
                sessionDirName,
                "subagents",
                filename,
              );
              handleFileChange(claudeProjectsDirPath, relativePath);
            },
          );

          watcher.on("error", () => {
            watcher.close();
            Effect.runPromise(
              Ref.update(projectWatchersRef, (watchers) => {
                const next = new Map(watchers);
                next.delete(watchKey);
                return next;
              }),
            );
          });

          Effect.runPromise(
            Ref.update(projectWatchersRef, (watchers) =>
              new Map(watchers).set(watchKey, watcher),
            ),
          );
        } catch {
          // subagents dir may not exist; that's fine
        }
      };

      /**
       * Scans existing project directories and sets up watchers.
       * Also discovers existing subagent directories.
       */
      const scanAndWatchAll = async (claudeProjectsDirPath: string) => {
        let entries: string[];
        try {
          entries = await readdir(claudeProjectsDirPath);
        } catch {
          return;
        }

        for (const entry of entries) {
          watchProjectDir(claudeProjectsDirPath, entry);

          // Scan for session subdirs that have subagents/
          const projectPath = path.join(claudeProjectsDirPath, entry);
          let subEntries: string[];
          try {
            subEntries = await readdir(projectPath);
          } catch {
            continue;
          }

          for (const subEntry of subEntries) {
            // Session directories are UUID-like directories
            if (subEntry.endsWith(".jsonl") || subEntry === "memory") continue;

            watchSubagentsDir(claudeProjectsDirPath, entry, subEntry);
          }
        }
      };

      const startWatching = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const isWatching = yield* Ref.get(isWatchingRef);
          if (isWatching) return;

          const claudeCodePaths = yield* context.claudeCodePaths;

          yield* Ref.set(isWatchingRef, true);

          yield* Effect.tryPromise({
            try: async () => {
              console.log(
                "Starting file watcher on:",
                claudeCodePaths.claudeProjectsDirPath,
              );

              // Watch the root projects dir (non-recursive) for new project directories
              const rootWatcher = watch(
                claudeCodePaths.claudeProjectsDirPath,
                { persistent: false, recursive: false },
                (_eventType, filename) => {
                  if (!filename) return;

                  // A new project directory may have appeared; set up a watcher for it
                  Effect.runPromise(
                    Effect.gen(function* () {
                      const watchers = yield* Ref.get(projectWatchersRef);
                      if (!watchers.has(filename)) {
                        watchProjectDir(
                          claudeCodePaths.claudeProjectsDirPath,
                          filename,
                        );
                      }
                    }),
                  );
                },
              );

              await Effect.runPromise(Ref.set(watcherRef, rootWatcher));

              // Set up watchers for all existing project and subagent directories
              await scanAndWatchAll(claudeCodePaths.claudeProjectsDirPath);

              console.log("File watcher initialization completed");
            },
            catch: (error) => {
              console.error("Failed to start file watching:", error);
              return new Error(
                `Failed to start file watching: ${String(error)}`,
              );
            },
          }).pipe(Effect.catchAll(() => Effect.void));
        });

      const stop = (): Effect.Effect<void> =>
        Effect.gen(function* () {
          const timers = yield* Ref.get(debounceTimersRef);
          for (const [, timer] of timers) {
            clearTimeout(timer);
          }
          yield* Ref.set(debounceTimersRef, new Map());

          const watcher = yield* Ref.get(watcherRef);
          if (watcher) {
            yield* Effect.sync(() => watcher.close());
            yield* Ref.set(watcherRef, null);
          }

          const projectWatchers = yield* Ref.get(projectWatchersRef);
          for (const [, projectWatcher] of projectWatchers) {
            yield* Effect.sync(() => projectWatcher.close());
          }
          yield* Ref.set(projectWatchersRef, new Map());
          yield* Ref.set(isWatchingRef, false);
        });

      return {
        startWatching,
        stop,
      } satisfies FileWatcherServiceInterface;
    }),
  );
}
