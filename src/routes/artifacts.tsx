import { createFileRoute } from "@tanstack/react-router";
import { ArtifactsPage } from "../app/artifacts/page";
import { ProtectedRoute } from "../components/ProtectedRoute";

export const Route = createFileRoute("/artifacts")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <ProtectedRoute>
      <ArtifactsPage />
    </ProtectedRoute>
  );
}
