import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import type { InferEffect } from "../../../lib/effect/types";
import { ApplicationContext } from "../../platform/services/ApplicationContext";
import { parseManifest } from "../functions/parseManifest";
import type { Artifact, ArtifactVersion } from "../types";

/**
 * Flat artifact directory structure:
 *
 * ~/.claude-artifacts/
 *   manifest.jsonl           # single global manifest
 *   <artifact-id>/
 *     v1/
 *       index.html
 *     v2/
 *       index.html
 *
 * Session/project association is stored in the manifest entry metadata,
 * not in the directory structure.
 */

function buildArtifactsFromEntries(
  entries: ReturnType<typeof parseManifest>,
): Map<string, Artifact> {
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
        project: entry.project ?? null,
        sessionId: entry.session_id ?? null,
        createdAt: new Date(entry.created_at),
        latestVersion: 1,
        versions: [
          {
            version: 1,
            createdAt: new Date(entry.created_at),
            changelog: null,
          },
        ],
      };
      artifactMap.set(entry.id, artifact);
    } else if (entry.action === "update") {
      const existing = artifactMap.get(entry.id);
      if (existing) {
        const version: ArtifactVersion = {
          version: entry.version,
          createdAt: new Date(entry.created_at),
          changelog: entry.changelog ?? null,
        };
        existing.versions.push(version);
        if (entry.version > existing.latestVersion) {
          existing.latestVersion = entry.version;
        }
      }
    }
  }

  return artifactMap;
}

const LayerImpl = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const pathService = yield* Path.Path;
  const context = yield* ApplicationContext;

  const readManifest = () =>
    Effect.gen(function* () {
      const { artifactsDirPath } = yield* context.claudeCodePaths;
      const manifestPath = pathService.resolve(
        artifactsDirPath,
        "manifest.jsonl",
      );

      const exists = yield* fs.exists(manifestPath);
      if (!exists) {
        return new Map<string, Artifact>();
      }

      const content = yield* fs.readFileString(manifestPath);
      const entries = parseManifest(content);
      return buildArtifactsFromEntries(entries);
    });

  const getAllArtifacts = () =>
    Effect.gen(function* () {
      const artifactMap = yield* readManifest();
      const allArtifacts = Array.from(artifactMap.values());

      allArtifacts.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      return allArtifacts;
    });

  const getArtifactsForSession = (_projectId: string, sessionId: string) =>
    Effect.gen(function* () {
      const artifactMap = yield* readManifest();
      return Array.from(artifactMap.values()).filter(
        (a) => a.sessionId === sessionId,
      );
    });

  const getArtifactFile = (
    artifactId: string,
    version: number,
    filePath: string,
  ) =>
    Effect.gen(function* () {
      const { artifactsDirPath } = yield* context.claudeCodePaths;
      const fullPath = pathService.resolve(
        artifactsDirPath,
        artifactId,
        `v${String(version)}`,
        filePath,
      );

      return yield* fs.readFile(fullPath);
    });

  return {
    getAllArtifacts,
    getArtifactsForSession,
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
