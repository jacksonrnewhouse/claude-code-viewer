import { Calendar, Hash, Layers, Search } from "lucide-react";
import { type FC, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AllArtifact } from "@/hooks/useArtifacts";

const ARTIFACT_TYPES = [
  "explanation",
  "comparison",
  "proposal",
  "debug-report",
  "dashboard",
  "review",
] as const;

type ArtifactType = (typeof ARTIFACT_TYPES)[number];

type Props = {
  artifacts: readonly AllArtifact[];
  isLoading: boolean;
  onSelect: (artifact: AllArtifact) => void;
};

const typeColorMap: Record<ArtifactType, string> = {
  explanation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  comparison:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  proposal: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "debug-report": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  dashboard:
    "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  review:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

function getTypeBadgeClass(type: string): string {
  return (
    typeColorMap[type as ArtifactType] ??
    "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function matchesSearch(artifact: AllArtifact, searchLower: string): boolean {
  if (artifact.title.toLowerCase().includes(searchLower)) return true;
  if (artifact.summary?.toLowerCase().includes(searchLower)) return true;
  if (artifact.tags.some((tag) => tag.toLowerCase().includes(searchLower)))
    return true;
  return false;
}

export const ArtifactList: FC<Props> = ({ artifacts, isLoading, onSelect }) => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return artifacts.filter((artifact) => {
      if (typeFilter !== "all" && artifact.type !== typeFilter) return false;
      if (searchLower && !matchesSearch(artifact, searchLower)) return false;
      return true;
    });
  }, [artifacts, search, typeFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading artifacts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, summary, or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ARTIFACT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {artifacts.length === 0
            ? "No artifacts found."
            : "No artifacts match your filters."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((artifact) => (
            <button
              key={`${artifact.project}-${artifact.sessionId}-${artifact.id}`}
              type="button"
              onClick={() => onSelect(artifact)}
              className="w-full text-left rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTypeBadgeClass(artifact.type)}`}
                    >
                      {artifact.type}
                    </span>
                    <h3 className="font-medium truncate">{artifact.title}</h3>
                  </div>
                  {artifact.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {artifact.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />v{artifact.latestVersion}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(artifact.createdAt)}
                    </span>
                    <span className="truncate max-w-[200px]">
                      {artifact.project}
                    </span>
                  </div>
                  {artifact.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      {artifact.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
