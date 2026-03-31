import { z } from "zod";

export const artifactTypeSchema = z.enum([
  "explanation",
  "comparison",
  "proposal",
  "debug-report",
  "dashboard",
  "review",
]);

const baseManifestEntrySchema = z.object({
  id: z.string(),
  created_at: z.string().datetime(),
  message_id: z.string().optional(),
});

export const createManifestEntrySchema = baseManifestEntrySchema.extend({
  action: z.literal("create"),
  title: z.string(),
  type: artifactTypeSchema,
  entry_point: z.string(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const updateManifestEntrySchema = baseManifestEntrySchema.extend({
  action: z.literal("update"),
  version: z.number().int().min(2),
  changelog: z.string().optional(),
});

export const manifestEntrySchema = z.discriminatedUnion("action", [
  createManifestEntrySchema,
  updateManifestEntrySchema,
]);

export const commentSchema = z.object({
  id: z.string(),
  created_at: z.string().datetime(),
  artifact_id: z.string(),
  artifact_version: z.number().int().min(1),
  highlighted_text: z.string(),
  selection_range: z
    .object({
      start: z.object({ node: z.string(), offset: z.number() }),
      end: z.object({ node: z.string(), offset: z.number() }),
    })
    .optional(),
  user_comment: z.string(),
  action: z.enum(["continue", "fork"]),
  target_session_id: z.string().optional(),
  response_message_id: z.string().optional(),
});
