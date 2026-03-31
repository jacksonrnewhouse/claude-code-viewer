import type { FC } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ArtifactVersion } from "@/server/core/artifact/types";

type Props = {
  versions: ArtifactVersion[];
  currentVersion: number;
  onVersionChange: (version: number) => void;
};

export const VersionSelector: FC<Props> = ({
  versions,
  currentVersion,
  onVersionChange,
}) => {
  if (versions.length < 2) {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      {versions.map((v) => {
        const isActive = v.version === currentVersion;
        const pill = (
          <button
            key={v.version}
            type="button"
            onClick={() => onVersionChange(v.version)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            v{v.version}
          </button>
        );

        if (v.changelog) {
          return (
            <Tooltip key={v.version}>
              <TooltipTrigger>{pill}</TooltipTrigger>
              <TooltipContent>{v.changelog}</TooltipContent>
            </Tooltip>
          );
        }

        return pill;
      })}
    </div>
  );
};
