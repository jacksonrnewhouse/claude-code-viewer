import { Context, Effect, Layer } from "effect";
import type { ControllerResponse } from "../../../lib/effect/toEffectResponse";
import type { InferEffect } from "../../../lib/effect/types";
import { ArtifactRepository } from "../infrastructure/ArtifactRepository";

const LayerImpl = Effect.gen(function* () {
  const artifactRepository = yield* ArtifactRepository;

  const getAllArtifacts = () =>
    Effect.gen(function* () {
      const artifacts = yield* artifactRepository.getAllArtifacts();
      return {
        status: 200,
        response: { artifacts },
      } as const satisfies ControllerResponse;
    });

  const getArtifactsForSession = (params: {
    projectId: string;
    sessionId: string;
  }) =>
    Effect.gen(function* () {
      const artifacts = yield* artifactRepository.getArtifactsForSession(
        params.projectId,
        params.sessionId,
      );
      return {
        status: 200,
        response: { artifacts },
      } as const satisfies ControllerResponse;
    });

  const getArtifactFile = (params: {
    artifactId: string;
    version: number;
    filePath: string;
  }) =>
    Effect.gen(function* () {
      return yield* artifactRepository.getArtifactFile(
        params.artifactId,
        params.version,
        params.filePath,
      );
    });

  const getStandaloneArtifact = (params: { artifactId: string }) =>
    Effect.gen(function* () {
      const allArtifacts = yield* artifactRepository.getAllArtifacts();
      const artifact = allArtifacts.find((a) => a.id === params.artifactId);
      if (!artifact) {
        return { found: false } as const;
      }
      const fileData = yield* artifactRepository.getArtifactFile(
        params.artifactId,
        artifact.latestVersion,
        artifact.entryPoint,
      );
      return { found: true, fileData, artifact } as const;
    });

  return {
    getAllArtifacts,
    getArtifactsForSession,
    getArtifactFile,
    getStandaloneArtifact,
  };
});

export type IArtifactController = InferEffect<typeof LayerImpl>;

export class ArtifactController extends Context.Tag("ArtifactController")<
  ArtifactController,
  IArtifactController
>() {
  static Live = Layer.effect(this, LayerImpl);
}
