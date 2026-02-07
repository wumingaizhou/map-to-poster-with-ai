import { App } from "./app";
import { config } from "./config/env";
import { createLogger } from "./utils/logger";
import { AuthService } from "./services/business/auth-service";
import { AiChatService } from "./services/business/ai-chat-service";
import { ThemesService } from "./services/business/themes-service";
import { GeocodingService } from "./services/business/geocoding-service";
import { PostersService } from "./services/business/posters-service";
import { IssueAnonymousSessionUseCase } from "./usecases/business/auth/issue-anonymous-session-usecase";
import { ChatStreamUseCase } from "./usecases/business/ai-chat/chat-stream-usecase";
import { StreamSessionEventsUseCase } from "./usecases/business/ai-chat/stream-session-events-usecase";
import { ListThemesUseCase } from "./usecases/business/themes/list-themes-usecase";
import { GeocodeUseCase } from "./usecases/business/geocode/geocode-usecase";
import { CreatePosterSessionUseCase } from "./usecases/business/posters/create-poster-session-usecase";
import { ListPosterVersionsUseCase } from "./usecases/business/posters/list-poster-versions-usecase";
import { DownloadPosterPngUseCase } from "./usecases/business/posters/download-poster-png-usecase";
import { DownloadPosterPreviewUseCase } from "./usecases/business/posters/download-poster-preview-usecase";
import { DeletePosterVersionUseCase } from "./usecases/business/posters/delete-poster-version-usecase";
import { AuthController } from "./controllers/business/auth-controller";
import { AiChatController } from "./controllers/business/ai-chat-controller";
import { ThemesController } from "./controllers/business/themes-controller";
import { GeocodeController } from "./controllers/business/geocode-controller";
import { PostersController } from "./controllers/business/posters-controller";
import { AuthRouter } from "./routes/business/auth-router";
import { AiChatRouter } from "./routes/business/ai-chat-router";
import { ThemesRouter } from "./routes/business/themes-router";
import { GeocodeRouter } from "./routes/business/geocode-router";
import { PostersRouter } from "./routes/business/posters-router";
import { PosterThemeRepository } from "./services/infra/theme/poster-theme-repository";
import { NominatimClient } from "./services/infra/geocoding/nominatim-client";
import { postersRuntime } from "./runtime/posters-runtime";
const log = createLogger("Main");
let app: App | null = null;
let isShuttingDown = false;
function createAiChatRouter(): AiChatRouter {
  const aiChatService = new AiChatService();
  const chatStreamUseCase = new ChatStreamUseCase(aiChatService);
  const streamSessionEventsUseCase = new StreamSessionEventsUseCase(aiChatService);
  const aiChatController = new AiChatController(chatStreamUseCase, streamSessionEventsUseCase);
  return new AiChatRouter(aiChatController);
}
function createAuthRouter(): AuthRouter {
  const authService = new AuthService();
  const issueAnonymousSessionUseCase = new IssueAnonymousSessionUseCase(authService);
  const authController = new AuthController(issueAnonymousSessionUseCase);
  return new AuthRouter(authController);
}
function createThemesRouter(themeRepository: PosterThemeRepository): ThemesRouter {
  const themesService = new ThemesService(themeRepository);
  const listThemesUseCase = new ListThemesUseCase(themesService);
  const themesController = new ThemesController(listThemesUseCase);
  return new ThemesRouter(themesController);
}
function createGeocodeRouter(): GeocodeRouter {
  const nominatimClient = new NominatimClient();
  const geocodingService = new GeocodingService(nominatimClient);
  const geocodeUseCase = new GeocodeUseCase(geocodingService);
  const geocodeController = new GeocodeController(geocodeUseCase);
  return new GeocodeRouter(geocodeController);
}
function createPostersRouter(postersService: PostersService): PostersRouter {
  const createPosterSessionUseCase = new CreatePosterSessionUseCase(postersService);
  const listPosterVersionsUseCase = new ListPosterVersionsUseCase(postersService);
  const downloadPosterPngUseCase = new DownloadPosterPngUseCase(postersService);
  const downloadPosterPreviewUseCase = new DownloadPosterPreviewUseCase(postersService);
  const deletePosterVersionUseCase = new DeletePosterVersionUseCase(postersService);
  const postersController = new PostersController(
    createPosterSessionUseCase,
    listPosterVersionsUseCase,
    downloadPosterPngUseCase,
    downloadPosterPreviewUseCase,
    deletePosterVersionUseCase
  );
  return new PostersRouter(postersController);
}
async function start(): Promise<void> {
  if (config.isProduction && !config.ai.exampleAgent.apiKey) {
    log.error(
      {
        envVar: "AI_EXAMPLE_AGENT_API_KEY",
        hint: "Please set AI_EXAMPLE_AGENT_API_KEY environment variable for production"
      },
      "Missing required API key for AI Agent"
    );
    throw new Error("Missing required environment variable: AI_EXAMPLE_AGENT_API_KEY");
  }
  log.info(
    {
      posters: { projectionMode: config.posters.projectionMode },
      geocoding: {
        bboxCenterScale: config.geocoding.bboxCenterScale,
        bboxMaxRadiusKm: config.geocoding.bboxMaxRadiusKm
      }
    },
    "Runtime config loaded"
  );
  await postersRuntime.workerPool.init();
  const authRouter = createAuthRouter();
  const aiChatRouter = createAiChatRouter();
  const themesRouter = createThemesRouter(postersRuntime.themeRepository);
  const geocodeRouter = createGeocodeRouter();
  const postersRouter = createPostersRouter(postersRuntime.postersService);
  app = new App([authRouter, aiChatRouter, themesRouter, geocodeRouter, postersRouter]);
  const port = config.port;
  app.listen(port);
  log.info({ port }, "Backend started");
}
async function shutdown(reason: string, error?: unknown): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info({ reason }, "Shutting down");
  if (error) {
    log.error({ error }, "Shutdown triggered by error");
  }
  const timeout = setTimeout(() => {
    log.error({ timeoutMs: config.app.forceExitTimeout }, "Force exit due to shutdown timeout");
    process.exit(1);
  }, config.app.forceExitTimeout);
  timeout.unref?.();
  try {
    const currentApp = app;
    app = null;
    await currentApp?.close();
    await postersRuntime.workerPool.terminate();
  } catch (closeError) {
    log.error({ error: closeError }, "Error during shutdown");
  } finally {
    clearTimeout(timeout);
  }
  log.info("Shutdown complete");
  process.exit(0);
}
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("uncaughtException", err => {
  void shutdown("uncaughtException", err);
});
process.on("unhandledRejection", reason => {
  void shutdown("unhandledRejection", reason);
});
void start().catch(err => {
  log.error({ error: err }, "Failed to start backend");
  void shutdown("startup failure", err);
});
