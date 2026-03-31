import { ExternalLink, FileText } from "lucide-react";
import type { FC } from "react";

const typeColors: Record<string, string> = {
  explanation: "bg-blue-100 text-blue-800",
  comparison: "bg-purple-100 text-purple-800",
  proposal: "bg-green-100 text-green-800",
  "debug-report": "bg-red-100 text-red-800",
  dashboard: "bg-yellow-100 text-yellow-800",
  review: "bg-gray-100 text-gray-800",
};

type ArtifactCardProps = {
  id: string;
  title: string;
  type: string;
  summary: string | null;
  latestVersion: number;
  projectId: string;
  sessionId: string;
};

export const ArtifactCard: FC<ArtifactCardProps> = ({
  id,
  title,
  type,
  summary,
  latestVersion,
  projectId,
  sessionId,
}) => {
  const badgeColor = typeColors[type] ?? "bg-gray-100 text-gray-800";
  const standaloneUrl = `/artifacts/${projectId}/${sessionId}/${id}`;

  return (
    <div className="my-2 mx-1 sm:mx-2 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <FileText className="h-5 w-5 text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {type}
            </span>
            {latestVersion > 1 && (
              <span className="text-xs text-gray-500 font-medium">
                v{latestVersion}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-gray-900 mt-1 truncate">
            {title}
          </h4>
          {summary && (
            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
              {summary}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <a
              href={standaloneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
