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
  messageId: string | null;
  createdAt: Date;
  latestVersion: number;
  versions: ArtifactVersion[];
  projectId: string;
  sessionId: string;
};

export type ArtifactVersion = {
  version: number;
  createdAt: Date;
  messageId: string | null;
  changelog: string | null;
};

export type ArtifactSummary = {
  id: string;
  title: string;
  type: ArtifactType;
  tags: string[];
  summary: string | null;
  createdAt: Date;
  latestVersion: number;
  projectId: string;
  sessionId: string;
};
