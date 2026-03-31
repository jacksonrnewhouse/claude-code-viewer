import { type FC, useCallback, useState } from "react";
import { type AllArtifact, useAllArtifacts } from "@/hooks/useArtifacts";
import { ArtifactList } from "./components/ArtifactList";
import { ArtifactViewer } from "./components/ArtifactViewer";

export const ArtifactsPage: FC = () => {
  const { data, isLoading } = useAllArtifacts();
  const [selected, setSelected] = useState<AllArtifact | null>(null);

  const handleBack = useCallback(() => {
    setSelected(null);
  }, []);

  if (selected) {
    const artifact = {
      ...selected,
      createdAt: new Date(selected.createdAt),
      versions: selected.versions.map((v) => ({
        ...v,
        createdAt: new Date(v.createdAt),
      })),
    };
    return (
      <div className="flex h-screen max-h-screen overflow-hidden">
        <div className="flex-1 overflow-auto">
          <ArtifactViewer
            artifact={artifact}
            projectId={selected.projectId}
            sessionId={selected.sessionId}
            onBack={handleBack}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-bold mb-1">Artifacts</h1>
            <p className="text-muted-foreground">
              Browse all artifacts across projects and sessions.
            </p>
          </header>
          <main>
            <ArtifactList
              artifacts={data?.artifacts ?? []}
              isLoading={isLoading}
              onSelect={setSelected}
            />
          </main>
        </div>
      </div>
    </div>
  );
};
