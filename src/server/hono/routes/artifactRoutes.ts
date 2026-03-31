import { Effect } from "effect";
import { Hono } from "hono";
import { ArtifactController } from "../../core/artifact/presentation/ArtifactController";
import { effectToResponse } from "../../lib/effect/toEffectResponse";
import type { HonoContext } from "../app";
import { getHonoRuntime } from "../runtime";

const contentTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".md": "text/markdown",
};

const getContentType = (filePath: string): string => {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return contentTypes[ext] ?? "application/octet-stream";
};

const artifactRoutes = Effect.gen(function* () {
  const controller = yield* ArtifactController;
  const runtime = yield* getHonoRuntime;

  return new Hono<HonoContext>()
    .get("/", async (c) => {
      const response = await effectToResponse(
        c,
        controller.getAllArtifacts().pipe(Effect.provide(runtime)),
      );
      return response;
    })
    .get("/projects/:projectId/sessions/:sessionId", async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      const response = await effectToResponse(
        c,
        controller
          .getArtifactsForSession({ projectId, sessionId })
          .pipe(Effect.provide(runtime)),
      );
      return response;
    })
    .get(
      "/projects/:projectId/sessions/:sessionId/artifacts/:artifactId/v/:version/*",
      async (c) => {
        const projectId = c.req.param("projectId");
        const sessionId = c.req.param("sessionId");
        const artifactId = c.req.param("artifactId");
        const version = parseInt(c.req.param("version"), 10);

        // Extract the wildcard path after /v/:version/
        const url = new URL(c.req.url);
        const prefix = `/api/artifacts/projects/${projectId}/sessions/${sessionId}/artifacts/${artifactId}/v/${String(version)}/`;
        const filePath = url.pathname.slice(prefix.length) || "index.html";

        const fileData = await Effect.runPromise(
          controller
            .getArtifactFile({
              projectId,
              sessionId,
              artifactId,
              version,
              filePath,
            })
            .pipe(Effect.provide(runtime)),
        );

        const arrayBuffer = new ArrayBuffer(fileData.byteLength);
        new Uint8Array(arrayBuffer).set(fileData);
        return new Response(arrayBuffer, {
          status: 200,
          headers: { "Content-Type": getContentType(filePath) },
        });
      },
    );
});

const standaloneArtifactRoutes = Effect.gen(function* () {
  const controller = yield* ArtifactController;
  const runtime = yield* getHonoRuntime;

  return new Hono<HonoContext>().get(
    "/artifacts/:projectId/:sessionId/:artifactId",
    async (c) => {
      const projectId = c.req.param("projectId");
      const sessionId = c.req.param("sessionId");
      const artifactId = c.req.param("artifactId");

      const result = await Effect.runPromise(
        controller
          .getStandaloneArtifact({ projectId, sessionId, artifactId })
          .pipe(Effect.provide(runtime)),
      );

      if (!result.found) {
        return c.text("Artifact not found", 404);
      }

      const decoder = new TextDecoder();
      const html = decoder.decode(result.fileData);

      // Inject the overlay script before </body> (will 404 silently until Phase 2)
      const overlayScript =
        '<script src="/__viewer__/artifact-overlay.js"></script>';
      const injectedHtml = html.includes("</body>")
        ? html.replace("</body>", `${overlayScript}</body>`)
        : `${html}${overlayScript}`;

      return c.html(injectedHtml);
    },
  );
});

export { artifactRoutes, standaloneArtifactRoutes };
