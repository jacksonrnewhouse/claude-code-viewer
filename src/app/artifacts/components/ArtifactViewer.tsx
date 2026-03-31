"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { type FC, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Artifact } from "@/server/core/artifact/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { VersionSelector } from "./VersionSelector";

type Props = {
  artifact: Artifact;
  onBack?: () => void;
};

function buildFileUrl(
  artifactId: string,
  version: number,
  entryPoint: string,
): string {
  return `/api/artifacts/files/${artifactId}/v/${version}/${entryPoint}`;
}

export const ArtifactViewer: FC<Props> = ({ artifact, onBack }) => {
  const [currentVersion, setCurrentVersion] = useState(artifact.latestVersion);

  const isMarkdown = artifact.entryPoint.endsWith(".md");
  const fileUrl = buildFileUrl(
    artifact.id,
    currentVersion,
    artifact.entryPoint,
  );
  const standaloneUrl = `/artifacts/${artifact.id}`;

  const { data: markdownContent, isLoading: isMarkdownLoading } = useQuery({
    queryKey: ["artifact-content", artifact.id, currentVersion],
    queryFn: async () => {
      const response = await fetch(fileUrl);
      return response.text();
    },
    enabled: isMarkdown,
  });

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <h2 className="truncate text-sm font-semibold text-gray-900">
            {artifact.title}
          </h2>
          <Badge variant="secondary">{artifact.type}</Badge>
        </div>
        <VersionSelector
          versions={artifact.versions}
          currentVersion={currentVersion}
          onVersionChange={setCurrentVersion}
        />
        <a
          href={standaloneUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </a>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto bg-white">
        {isMarkdown ? (
          isMarkdownLoading ? (
            <div className="flex items-center justify-center py-12 text-sm text-gray-500">
              Loading...
            </div>
          ) : markdownContent ? (
            <MarkdownRenderer content={markdownContent} />
          ) : null
        ) : (
          <iframe
            src={fileUrl}
            title={artifact.title}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
};
