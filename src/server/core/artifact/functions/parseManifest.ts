import { manifestEntrySchema } from "../schema";
import type { ManifestEntry } from "../types";

export function parseManifest(content: string): ManifestEntry[] {
  const lines = content.split("\n").filter((line) => line.trim());
  const entries: ManifestEntry[] = [];

  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line);
      const result = manifestEntrySchema.safeParse(parsed);
      if (result.success) {
        entries.push(result.data);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}
