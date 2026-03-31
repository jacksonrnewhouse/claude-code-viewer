import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { honoClient } from "@/lib/api/client";

export const sessionArtifactsQuery = (
  projectId: string,
  sessionId: string,
) => ({
  queryKey: ["artifacts", "projects", projectId, "sessions", sessionId],
  queryFn: async () => {
    const response = await honoClient.api.artifacts.projects[
      ":projectId"
    ].sessions[":sessionId"].$get({
      param: { projectId, sessionId },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch artifacts: ${response.statusText}`);
    }

    return await response.json();
  },
});

type SessionArtifactsQueryFn = ReturnType<
  typeof sessionArtifactsQuery
>["queryFn"];
type SessionArtifactsResponse = Awaited<ReturnType<SessionArtifactsQueryFn>>;
type SessionArtifact = SessionArtifactsResponse["artifacts"][number];

export const useSessionArtifacts = (
  projectId: string,
  sessionId: string | undefined,
) => {
  const query = useQuery({
    ...sessionArtifactsQuery(projectId, sessionId ?? ""),
    enabled: sessionId !== undefined,
  });

  const artifactsByMessageId = useMemo(() => {
    const map = new Map<string, SessionArtifact>();
    if (query.data?.artifacts) {
      for (const artifact of query.data.artifacts) {
        if (artifact.messageId) {
          map.set(artifact.messageId, artifact);
        }
      }
    }
    return map;
  }, [query.data]);

  return {
    ...query,
    artifactsByMessageId,
  };
};
