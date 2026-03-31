import type { z } from "zod";
import type {
  artifactTypeSchema,
  commentSchema,
  createManifestEntrySchema,
  manifestEntrySchema,
  updateManifestEntrySchema,
} from "./schema";

export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type CreateManifestEntry = z.infer<typeof createManifestEntrySchema>;
export type UpdateManifestEntry = z.infer<typeof updateManifestEntrySchema>;
export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export type Comment = z.infer<typeof commentSchema>;

export type Artifact = {
  id: string;
  title: string;
  type: ArtifactType;
  entryPoint: string;
  tags: string[];
  summary: string | null;
  project: string | null;
  sessionId: string | null;
  createdAt: Date;
  latestVersion: number;
  versions: ArtifactVersion[];
};

export type ArtifactVersion = {
  version: number;
  createdAt: Date;
  changelog: string | null;
};
