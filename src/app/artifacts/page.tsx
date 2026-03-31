import { ArrowLeft } from "lucide-react";
import { type FC, useCallback, useState } from "react";
import { type AllArtifact, useAllArtifacts } from "@/hooks/useArtifacts";
import { ArtifactList } from "./components/ArtifactList";
import { ArtifactViewer } from "./components/ArtifactViewer";

const ArtifactsNav: FC = () => (
  <nav className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
    <a
      href="/projects"
      className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Projects
    </a>
    <span className="text-gray-300">|</span>
    <span className="text-sm font-semibold text-gray-900">Artifacts</span>
  </nav>
);

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
      <div className="flex h-screen max-h-screen flex-col overflow-hidden">
        <ArtifactsNav />
        <div className="flex-1 overflow-auto">
          <ArtifactViewer artifact={artifact} onBack={handleBack} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen max-h-screen flex-col overflow-hidden">
      <ArtifactsNav />
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
