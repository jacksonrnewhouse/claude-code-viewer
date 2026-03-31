import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import type { InferEffect } from "../../../lib/effect/types";
import { ApplicationContext } from "../../platform/services/ApplicationContext";
import { decodeProjectId } from "../../project/functions/id";
import { parseManifest } from "../functions/parseManifest";
import type { Artifact, ArtifactVersion } from "../types";

/**
 * Extract the directory basename from an encoded project ID.
 * Encoded project IDs decode to full paths like "/root/.claude/projects/-workspaces-foo".
 * The artifacts directory uses just the basename: "-workspaces-foo".
 * If the ID is already a plain directory name (not base64), return it as-is.
 */
function projectIdToArtifactDir(projectId: string): string {
  try {
    const decoded = decodeProjectId(projectId);
    // If decoding produced a path, take the last segment
    const segments = decoded.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? projectId;
  } catch {
    return projectId;
  }
}

const LayerImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const context = yield* ApplicationContext;

  const getArtifactsForSession = (projectId: string, sessionId: string) =>
    Effect.gen(function* () {
      const { artifactsDirPath } = yield* context.claudeCodePaths;
      const artifactDir = projectIdToArtifactDir(projectId);
      const manifestPath = pathService.resolve(
        artifactsDirPath,
        artifactDir,
        sessionId,
        "manifest.jsonl",
      );

      const exists = yield* fs.exists(manifestPath);
      if (!exists) {
        return [] satisfies Artifact[];
      }

      const content = yield* fs.readFileString(manifestPath);
      const entries = parseManifest(content);

      const artifactMap = new Map<string, Artifact>();

      for (const entry of entries) {
        if (entry.action === "create") {
          const artifact: Artifact = {
            id: entry.id,
            title: entry.title,
            type: entry.type,
            entryPoint: entry.entry_point,
            tags: entry.tags ?? [],
            summary: entry.summary ?? null,
            messageId: entry.message_id ?? null,
            createdAt: new Date(entry.created_at),
            latestVersion: 1,
            versions: [
              {
                version: 1,
                createdAt: new Date(entry.created_at),
                messageId: entry.message_id ?? null,
                changelog: null,
              },
            ],
            projectId,
            sessionId,
          };
          artifactMap.set(entry.id, artifact);
        } else if (entry.action === "update") {
          const existing = artifactMap.get(entry.id);
          if (existing) {
            const version: ArtifactVersion = {
              version: entry.version,
              createdAt: new Date(entry.created_at),
              messageId: entry.message_id ?? null,
              changelog: entry.changelog ?? null,
            };
            existing.versions.push(version);
            if (entry.version > existing.latestVersion) {
              existing.latestVersion = entry.version;
            }
          }
        }
      }

      return Array.from(artifactMap.values());
    });

  const getAllArtifacts = () =>
    Effect.gen(function* () {
      const { artifactsDirPath } = yield* context.claudeCodePaths;

      const dirExists = yield* fs.exists(artifactsDirPath);
      if (!dirExists) {
        return [] satisfies Artifact[];
      }

      const projectDirs = yield* fs.readDirectory(artifactsDirPath);

      const allArtifacts: Artifact[] = [];

      for (const projectDir of projectDirs) {
        const projectPath = pathService.resolve(artifactsDirPath, projectDir);
        const projectStat = yield* fs.stat(projectPath);
        if (projectStat.type !== "Directory") {
          continue;
        }

        const sessionDirs = yield* fs.readDirectory(projectPath);

        for (const sessionDir of sessionDirs) {
          const sessionPath = pathService.resolve(projectPath, sessionDir);
          const sessionStat = yield* fs.stat(sessionPath);
          if (sessionStat.type !== "Directory") {
            continue;
          }

          const artifacts = yield* getArtifactsForSession(
            projectDir,
            sessionDir,
          );
          allArtifacts.push(...artifacts);
        }
      }

      allArtifacts.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      return allArtifacts;
    });

  const getArtifactFile = (
    projectId: string,
    sessionId: string,
    artifactId: string,
    version: number,
    filePath: string,
  ) =>
    Effect.gen(function* () {
      const { artifactsDirPath } = yield* context.claudeCodePaths;
      const artifactDir = projectIdToArtifactDir(projectId);
      const fullPath = pathService.resolve(
        artifactsDirPath,
        artifactDir,
        sessionId,
        artifactId,
        `v${String(version)}`,
        filePath,
      );

      return yield* fs.readFile(fullPath);
    });

  return {
    getArtifactsForSession,
    getAllArtifacts,
    getArtifactFile,
  };
});

export type IArtifactRepository = InferEffect<typeof LayerImpl>;

export class ArtifactRepository extends Context.Tag("ArtifactRepository")<
  ArtifactRepository,
  IArtifactRepository
>() {
  static Live = Layer.effect(this, LayerImpl);
}
